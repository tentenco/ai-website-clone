const allowedKinds = new Set(["interaction", "motion"]);
const numericDomains = new Set(["geometry", "timingMs", "scrollProgress"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function flatten(value, prefix = "", output = new Map()) {
  if (isPlainObject(value)) {
    for (const key of Object.keys(value).sort()) {
      const path = prefix ? `${prefix}.${key}` : key;
      flatten(value[key], path, output);
    }
  } else {
    output.set(prefix || "$", value);
  }
  return output;
}

function assertFiniteTree(value, domain, checkpointId) {
  for (const [path, leaf] of flatten(value)) {
    if (typeof leaf !== "number" || !Number.isFinite(leaf)) {
      throw new Error(
        `${checkpointId}.${domain}.${path} must be a finite number`,
      );
    }
    if (domain === "scrollProgress" && (leaf < 0 || leaf > 1)) {
      throw new Error(
        `${checkpointId}.${domain}.${path} must be between 0 and 1`,
      );
    }
  }
}

export function validateCheckpointDocument(document, label = "checkpoint document") {
  if (!isPlainObject(document) || !Array.isArray(document.checkpoints)) {
    throw new Error(`${label} must contain a checkpoints array`);
  }
  const ids = new Set();
  for (const checkpoint of document.checkpoints) {
    if (!isPlainObject(checkpoint) || typeof checkpoint.id !== "string" || !checkpoint.id) {
      throw new Error(`${label} contains a checkpoint without a non-empty id`);
    }
    if (ids.has(checkpoint.id)) {
      throw new Error(`${label} contains duplicate checkpoint id ${checkpoint.id}`);
    }
    ids.add(checkpoint.id);
    if (!allowedKinds.has(checkpoint.kind)) {
      throw new Error(
        `${checkpoint.id}.kind must be interaction or motion`,
      );
    }
    for (const domain of numericDomains) {
      if (checkpoint[domain] !== undefined) {
        assertFiniteTree(checkpoint[domain], domain, checkpoint.id);
      }
    }
    if (checkpoint.state !== undefined && !isPlainObject(checkpoint.state)) {
      throw new Error(`${checkpoint.id}.state must be an object`);
    }
    const comparableDomains = [...numericDomains, "state"].filter(
      (domain) => checkpoint[domain] !== undefined,
    );
    if (comparableDomains.length === 0) {
      throw new Error(`${checkpoint.id} has no comparable domains`);
    }
  }
  return document;
}

function valuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function withinTolerance(left, right, delta, tolerance) {
  const roundingSlack = Number.EPSILON
    * Math.max(1, Math.abs(left), Math.abs(right), Math.abs(tolerance))
    * 8;
  return delta <= tolerance + roundingSlack;
}

function compareDomain(domain, sourceValue, cloneValue, tolerance) {
  const source = flatten(sourceValue);
  const clone = flatten(cloneValue);
  const paths = [...new Set([...source.keys(), ...clone.keys()])].sort();
  return paths.map((path) => {
    const sourceHas = source.has(path);
    const cloneHas = clone.has(path);
    const sourceLeaf = source.get(path);
    const cloneLeaf = clone.get(path);
    if (!sourceHas || !cloneHas) {
      return {
        domain,
        path,
        sourceValue: sourceHas ? sourceLeaf : null,
        cloneValue: cloneHas ? cloneLeaf : null,
        status: "fail",
        reason: sourceHas ? "missing clone value" : "unexpected clone value",
      };
    }
    if (numericDomains.has(domain)) {
      const delta = Math.abs(sourceLeaf - cloneLeaf);
      return {
        domain,
        path,
        sourceValue: sourceLeaf,
        cloneValue: cloneLeaf,
        delta,
        tolerance,
        status: withinTolerance(sourceLeaf, cloneLeaf, delta, tolerance) ? "pass" : "fail",
      };
    }
    return {
      domain,
      path,
      sourceValue: sourceLeaf,
      cloneValue: cloneLeaf,
      status: valuesEqual(sourceLeaf, cloneLeaf) ? "pass" : "fail",
    };
  });
}

export function compareCheckpointDocuments(sourceDocument, cloneDocument, options = {}) {
  validateCheckpointDocument(sourceDocument, "source checkpoint document");
  validateCheckpointDocument(cloneDocument, "clone checkpoint document");
  const tolerances = {
    geometryPx: options.geometryPx ?? 2,
    timingMs: options.timingMs ?? 100,
    scrollProgress: options.scrollProgress ?? 0.02,
  };
  for (const [name, value] of Object.entries(tolerances)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new Error(`${name} tolerance must be a finite non-negative number`);
    }
  }
  if (tolerances.scrollProgress > 1) {
    throw new Error("scrollProgress tolerance must be <= 1");
  }

  const source = new Map(sourceDocument.checkpoints.map((item) => [item.id, item]));
  const clone = new Map(cloneDocument.checkpoints.map((item) => [item.id, item]));
  const ids = [...new Set([...source.keys(), ...clone.keys()])].sort();
  const checkpoints = ids.map((id) => {
    const sourceCheckpoint = source.get(id);
    const cloneCheckpoint = clone.get(id);
    if (!sourceCheckpoint || !cloneCheckpoint) {
      return {
        id,
        kind: sourceCheckpoint?.kind ?? cloneCheckpoint.kind,
        comparisons: [{
          domain: "checkpoint",
          path: id,
          sourceValue: sourceCheckpoint ? "present" : null,
          cloneValue: cloneCheckpoint ? "present" : null,
          status: "fail",
          reason: sourceCheckpoint ? "missing clone checkpoint" : "unexpected clone checkpoint",
        }],
        status: "fail",
      };
    }
    const comparisons = [];
    if (sourceCheckpoint.kind !== cloneCheckpoint.kind) {
      comparisons.push({
        domain: "checkpoint",
        path: "kind",
        sourceValue: sourceCheckpoint.kind,
        cloneValue: cloneCheckpoint.kind,
        status: "fail",
      });
    }
    for (const domain of [...numericDomains, "state"]) {
      const sourceHas = sourceCheckpoint[domain] !== undefined;
      const cloneHas = cloneCheckpoint[domain] !== undefined;
      if (!sourceHas && !cloneHas) continue;
      const tolerance = domain === "geometry"
        ? tolerances.geometryPx
        : domain === "timingMs"
          ? tolerances.timingMs
          : domain === "scrollProgress"
            ? tolerances.scrollProgress
            : undefined;
      comparisons.push(...compareDomain(
        domain,
        sourceHas ? sourceCheckpoint[domain] : {},
        cloneHas ? cloneCheckpoint[domain] : {},
        tolerance,
      ));
    }
    return {
      id,
      kind: sourceCheckpoint.kind,
      comparisons,
      status: comparisons.every((comparison) => comparison.status === "pass")
        ? "pass"
        : "fail",
    };
  });

  const comparisonCounts = checkpoints
    .flatMap((checkpoint) => checkpoint.comparisons)
    .reduce(
      (counts, comparison) => {
        counts[comparison.status] += 1;
        return counts;
      },
      { pass: 0, fail: 0 },
    );
  return {
    schemaVersion: "1.0.0",
    sourceScenarioId: sourceDocument.scenarioId ?? null,
    cloneScenarioId: cloneDocument.scenarioId ?? null,
    tolerances,
    checkpoints,
    summary: {
      status: comparisonCounts.fail === 0 ? "pass" : "fail",
      checkpointCount: checkpoints.length,
      comparisonCounts,
    },
  };
}
