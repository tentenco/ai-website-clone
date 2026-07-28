import { readFile } from "node:fs/promises";

export async function readJson(path) {
  let source;
  try {
    source = await readFile(path, "utf8");
  } catch (error) {
    throw new Error(`Cannot read ${path}: ${error.message}`);
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`Cannot parse JSON in ${path}: ${error.message}`);
  }
}

export function collectGates(report) {
  const gates = [];
  const add = (path, id, status) => {
    gates.push({ path, id, status });
  };

  for (const [index, scenario] of (report.captureScenarios ?? []).entries()) {
    add(`captureScenarios[${index}]`, scenario.id, scenario.status);
  }
  for (const [index, checkpoint] of (report.staticCheckpoints ?? []).entries()) {
    add(`staticCheckpoints[${index}]`, checkpoint.id, checkpoint.status);
  }
  for (const [index, state] of (report.responsiveStates ?? []).entries()) {
    add(`responsiveStates[${index}]`, state.id, state.status);
  }
  for (const [index, interaction] of (report.interactions ?? []).entries()) {
    add(`interactions[${index}]`, interaction.id, interaction.status);
  }
  for (const [index, checkpoint] of (report.motionCheckpoints ?? []).entries()) {
    add(`motionCheckpoints[${index}]`, checkpoint.id, checkpoint.status);
  }
  if (report.accessibility) {
    add("accessibility", "accessibility", report.accessibility.status);
    for (const [index, check] of (report.accessibility.checks ?? []).entries()) {
      add(`accessibility.checks[${index}]`, check.id, check.status);
    }
    if (report.accessibility.reducedMotion) {
      add(
        "accessibility.reducedMotion",
        "reduced-motion",
        report.accessibility.reducedMotion.status,
      );
      for (const [index, check] of (
        report.accessibility.reducedMotion.checks ?? []
      ).entries()) {
        add(`accessibility.reducedMotion.checks[${index}]`, check.id, check.status);
      }
    }
  }
  if (report.buildRuntime) {
    add("buildRuntime", "build-runtime", report.buildRuntime.status);
    for (const [index, gate] of (report.buildRuntime.gates ?? []).entries()) {
      add(`buildRuntime.gates[${index}]`, gate.id, gate.status);
    }
  }
  return gates;
}

function deriveStatus(counts, report) {
  const openFailures = (report.discrepancies ?? []).filter(
    (item) => item.status === "open"
      && ["critical", "major", "minor"].includes(item.severity),
  );
  const blockedDiscrepancies = (report.discrepancies ?? []).filter(
    (item) => item.status === "blocked" || (
      item.status === "open" && item.classification === "unknown"
    ),
  );
  const unapprovedDifferences = (report.deliberateDifferences ?? []).filter(
    (item) => item.status === "unapproved",
  );

  if (counts.fail > 0 || openFailures.length > 0 || unapprovedDifferences.length > 0) {
    return "fail";
  }
  if (counts.blocked > 0 || blockedDiscrepancies.length > 0) {
    return "blocked";
  }
  return "pass";
}

export function summarizeReport(report) {
  const gates = collectGates(report);
  const counts = { pass: 0, fail: 0, blocked: 0 };
  for (const gate of gates) {
    if (Object.hasOwn(counts, gate.status)) counts[gate.status] += 1;
  }
  const derivedStatus = deriveStatus(counts, report);
  const declaredStatus = report.final?.status ?? null;
  return {
    target: report.target?.slug ?? null,
    declaredStatus,
    derivedStatus,
    consistent: declaredStatus === derivedStatus,
    counts,
    failedGateIds: gates.filter((gate) => gate.status === "fail").map((gate) => gate.id),
    blockedGateIds: gates.filter((gate) => gate.status === "blocked").map((gate) => gate.id),
    openDiscrepancyIds: (report.discrepancies ?? [])
      .filter((item) => item.status === "open")
      .map((item) => item.id),
    unapprovedDifferenceIds: (report.deliberateDifferences ?? [])
      .filter((item) => item.status === "unapproved")
      .map((item) => item.id),
  };
}

function collectIds(report) {
  const collections = [
    ["captureScenarios", report.captureScenarios],
    ["staticCheckpoints", report.staticCheckpoints],
    ["responsiveStates", report.responsiveStates],
    ["interactions", report.interactions],
    ["motionCheckpoints", report.motionCheckpoints],
    ["deliberateDifferences", report.deliberateDifferences],
    ["discrepancies", report.discrepancies],
    ["evidence", report.evidence],
  ];
  const seen = new Map();
  const duplicates = [];
  for (const [collectionName, collection] of collections) {
    for (const [index, item] of (collection ?? []).entries()) {
      if (!item?.id) continue;
      const path = `${collectionName}[${index}].id`;
      if (seen.has(item.id)) duplicates.push({ id: item.id, first: seen.get(item.id), path });
      else seen.set(item.id, path);
    }
  }
  return { seen, duplicates };
}

function childStatuses(value) {
  if (!value || typeof value !== "object") return [];
  const statuses = [];
  for (const [key, child] of Object.entries(value)) {
    if (key === "status") continue;
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === "object" && ["pass", "fail", "blocked"].includes(item.status)) {
          statuses.push(item.status);
        }
      }
    } else if (child && typeof child === "object"
      && ["pass", "fail", "blocked"].includes(child.status)) {
      statuses.push(child.status);
    }
  }
  return statuses;
}

function expectedAggregateStatus(statuses) {
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("blocked")) return "blocked";
  if (statuses.length > 0) return "pass";
  return null;
}

export function validateReportSemantics(report) {
  const errors = [];
  const evidenceIds = new Set((report.evidence ?? []).map((item) => item.id));
  const scenarioIds = new Set((report.captureScenarios ?? []).map((item) => item.id));
  const gates = collectGates(report);
  const gateIds = new Set();
  for (const gate of gates) {
    if (gateIds.has(gate.id)) {
      errors.push({ path: gate.path, message: `duplicate gate id ${JSON.stringify(gate.id)}` });
    }
    gateIds.add(gate.id);
  }
  const { duplicates } = collectIds(report);
  for (const duplicate of duplicates) {
    errors.push({
      path: duplicate.path,
      message: `duplicate id ${JSON.stringify(duplicate.id)} first used at ${duplicate.first}`,
    });
  }

  const walkEvidenceRefs = (value, path = "$") => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => walkEvidenceRefs(item, `${path}/${index}`));
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === "evidenceIds" && Array.isArray(child)) {
        child.forEach((id, index) => {
          if (!evidenceIds.has(id)) {
            errors.push({
              path: `${path}/${key}/${index}`,
              message: `unknown evidence id ${JSON.stringify(id)}`,
            });
          }
        });
      } else {
        walkEvidenceRefs(child, `${path}/${key}`);
      }
    }
  };
  walkEvidenceRefs(report);

  const validateGateRefs = (ids, path) => {
    for (const [index, id] of (ids ?? []).entries()) {
      if (!gateIds.has(id)) {
        errors.push({
          path: `${path}/${index}`,
          message: `unknown gate id ${JSON.stringify(id)}`,
        });
      }
    }
  };
  for (const [index, difference] of (report.deliberateDifferences ?? []).entries()) {
    validateGateRefs(
      difference.affectedGateIds,
      `$.deliberateDifferences/${index}/affectedGateIds`,
    );
  }
  for (const [index, discrepancy] of (report.discrepancies ?? []).entries()) {
    validateGateRefs(
      discrepancy.affectedGateIds,
      `$.discrepancies/${index}/affectedGateIds`,
    );
  }
  for (const [index, item] of (report.evidence ?? []).entries()) {
    validateGateRefs(item.relatedGateIds, `$.evidence/${index}/relatedGateIds`);
  }

  for (const [collectionName, collection] of [
    ["staticCheckpoints", report.staticCheckpoints],
    ["responsiveStates", report.responsiveStates],
    ["interactions", report.interactions],
    ["motionCheckpoints", report.motionCheckpoints],
  ]) {
    for (const [index, item] of (collection ?? []).entries()) {
      if (!scenarioIds.has(item.scenarioId)) {
        errors.push({
          path: `$.${collectionName}/${index}/scenarioId`,
          message: `unknown capture scenario ${JSON.stringify(item.scenarioId)}`,
        });
      }
    }
  }

  for (const [index, difference] of (report.deliberateDifferences ?? []).entries()) {
    if (difference.status === "approved" && !difference.approval) {
      errors.push({
        path: `$.deliberateDifferences/${index}`,
        message: "approved deliberate difference requires approval provenance",
      });
    }
  }

  for (const [index, discrepancy] of (report.discrepancies ?? []).entries()) {
    const path = `$.discrepancies/${index}`;
    if (["resolved", "accepted"].includes(discrepancy.status) && !discrepancy.resolution) {
      errors.push({ path, message: `${discrepancy.status} discrepancy requires a resolution` });
    }
    if (
      discrepancy.classification === "specification-defect"
      && discrepancy.status === "resolved"
      && (
        discrepancy.resolution?.kind !== "specification-correction"
        || !discrepancy.resolution?.authorityArtifact
      )
    ) {
      errors.push({
        path,
        message: "resolved specification defect requires specification-correction and authorityArtifact",
      });
    }
    if (
      discrepancy.classification === "implementation-defect"
      && discrepancy.status === "resolved"
      && discrepancy.resolution?.kind !== "implementation-fix"
    ) {
      errors.push({
        path,
        message: "resolved implementation defect requires an implementation-fix",
      });
    }
    if (
      discrepancy.classification === "capture-defect"
      && discrepancy.status === "resolved"
      && discrepancy.resolution?.kind !== "capture-replay"
    ) {
      errors.push({
        path,
        message: "resolved capture defect requires a capture-replay",
      });
    }
    if (
      discrepancy.classification === "approved-difference"
      && discrepancy.status === "accepted"
      && discrepancy.resolution?.kind !== "accepted-deliberate-difference"
    ) {
      errors.push({
        path,
        message: "accepted difference requires accepted-deliberate-difference resolution",
      });
    }
  }

  if (report.target?.mode === "clone") {
    const invented = (report.evidence ?? [])
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.level === "invented");
    const approvedEvidence = new Set(
      (report.deliberateDifferences ?? [])
        .filter((item) => item.status === "approved")
        .flatMap((item) => item.evidenceIds ?? []),
    );
    invented.forEach(({ item, index }) => {
      if (!approvedEvidence.has(item.id)) {
        errors.push({
          path: `$.evidence/${index}`,
          message: "invented clone evidence requires an approved deliberate difference",
        });
      }
    });
  }

  for (const [path, aggregate] of [
    ["$.accessibility", report.accessibility],
    ["$.accessibility/reducedMotion", report.accessibility?.reducedMotion],
    ["$.buildRuntime", report.buildRuntime],
  ]) {
    if (!aggregate) continue;
    const expected = expectedAggregateStatus(childStatuses(aggregate));
    if (expected && aggregate.status !== expected) {
      errors.push({
        path,
        message: `aggregate status ${aggregate.status} conflicts with child status ${expected}`,
      });
    }
  }

  const aggregateCollections = [
    ["staticCheckpoints", report.staticCheckpoints],
    ["responsiveStates", report.responsiveStates],
    ["interactions", report.interactions],
    ["motionCheckpoints", report.motionCheckpoints],
  ];
  for (const [collectionName, collection] of aggregateCollections) {
    for (const [index, aggregate] of (collection ?? []).entries()) {
      const expected = expectedAggregateStatus(childStatuses(aggregate));
      if (expected && aggregate.status !== expected) {
        errors.push({
          path: `$.${collectionName}/${index}`,
          message: `aggregate status ${aggregate.status} conflicts with child status ${expected}`,
        });
      }
      for (const [checkpointIndex, checkpoint] of (
        aggregate.checkpointComparisons ?? []
      ).entries()) {
        const checkpointExpected = expectedAggregateStatus(
          checkpoint.comparisons?.map((comparison) => comparison.status) ?? [],
        );
        if (checkpointExpected && checkpoint.status !== checkpointExpected) {
          errors.push({
            path: `$.${collectionName}/${index}/checkpointComparisons/${checkpointIndex}`,
            message: `checkpoint status ${checkpoint.status} conflicts with comparison status ${checkpointExpected}`,
          });
        }
      }
    }
  }

  const numericComparisons = [
    ...(report.staticCheckpoints ?? []).flatMap((item) => item.geometry ?? []),
    ...(report.responsiveStates ?? []).flatMap((item) => item.geometry ?? []),
  ];
  for (const comparison of numericComparisons) {
    const delta = Math.abs(comparison.source - comparison.clone);
    const slack = Number.EPSILON
      * Math.max(1, Math.abs(comparison.source), Math.abs(comparison.clone))
      * 8;
    if (Math.abs(delta - comparison.delta) > slack) {
      errors.push({
        path: `numericComparison:${comparison.id}`,
        message: `declared delta ${comparison.delta} but measured ${delta}`,
      });
    }
    const expected = delta <= comparison.tolerance + slack ? "pass" : "fail";
    if (comparison.status !== expected) {
      errors.push({
        path: `numericComparison:${comparison.id}`,
        message: `declared ${comparison.status} but tolerance result is ${expected}`,
      });
    }
  }

  const summary = summarizeReport(report);
  if (report.final?.status && report.final.status !== summary.derivedStatus) {
    errors.push({
      path: "$.final/status",
      message: `declared ${report.final.status} but deterministic gate summary is ${summary.derivedStatus}`,
    });
  }
  if (report.final?.counts) {
    for (const status of ["pass", "fail", "blocked"]) {
      if (report.final.counts[status] !== summary.counts[status]) {
        errors.push({
          path: `$.final/counts/${status}`,
          message: `declared ${report.final.counts[status]} but counted ${summary.counts[status]}`,
        });
      }
    }
  }
  return errors;
}
