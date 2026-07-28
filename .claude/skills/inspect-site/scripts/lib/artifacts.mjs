import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { validateAgainstSchema } from "./json-schema.mjs";

const SCHEMA_VERSION = "1.0.0";
const EVIDENCE_LEVELS = new Set(["measured", "observed", "inferred", "invented"]);
const SCENARIO_STATUSES = new Set([
  "planned",
  "in_progress",
  "captured",
  "blocked",
  "failed",
  "verified"
]);
const SCENARIO_FAMILIES = new Set([
  "initial",
  "full-page",
  "scroll",
  "navigation",
  "interaction",
  "hover-focus",
  "loading-empty-error",
  "reduced-motion",
  "media",
  "canvas-webgl",
  "responsive"
]);
const STEP_ACTIONS = new Set([
  "navigate",
  "reload",
  "scroll",
  "scrollTo",
  "click",
  "hover",
  "focus",
  "blur",
  "key",
  "type",
  "select",
  "wait",
  "assert",
  "playMedia",
  "pauseMedia",
  "screenshot",
  "probe",
  "custom"
]);
const CAPTURE_KINDS = new Set([
  "screenshot",
  "fullPageScreenshot",
  "domProbe",
  "video",
  "network",
  "trace",
  "mediaMetadata",
  "canvasTelemetry",
  "webglTelemetry"
]);
const ASSET_KINDS = new Set([
  "image",
  "pictureSource",
  "video",
  "audio",
  "mediaSource",
  "track",
  "cssUrl",
  "lottie",
  "rive",
  "animationData",
  "canvas",
  "webgl",
  "font",
  "manifest",
  "iframe"
]);
const ATTEMPT_STATUSES = new Set(["in_progress", "captured", "blocked", "failed"]);
const UNKNOWN_STATUSES = new Set(["open", "accepted", "resolved"]);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SITE_INSPECTION_SCHEMA = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        "../../../../../docs/research/schemas/site-inspection.schema.json",
        import.meta.url,
      ),
    ),
    "utf8",
  ),
);
const CAPTURE_SCENARIOS_SCHEMA = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        "../../../../../docs/research/schemas/capture-scenarios.schema.json",
        import.meta.url,
      ),
    ),
    "utf8",
  ),
);
const CAPTURE_SCHEMA = {
  $defs: SITE_INSPECTION_SCHEMA.$defs,
  $ref: "#/$defs/capture",
};

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isDateTime(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isUrl(value) {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function collector() {
  const errors = [];
  return {
    errors,
    add(path, message) {
      errors.push({ path, message });
    },
    result() {
      return { valid: errors.length === 0, errors };
    }
  };
}

function combineValidation(structural, semantic) {
  const errors = [...structural.errors, ...semantic.errors];
  return { valid: errors.length === 0, errors };
}

function objectAt(value, path, check) {
  if (!isObject(value)) {
    check.add(path, "must be an object");
    return false;
  }
  return true;
}

function arrayAt(value, path, check, minimum = 0) {
  if (!Array.isArray(value)) {
    check.add(path, "must be an array");
    return false;
  }
  if (value.length < minimum) {
    check.add(path, `must contain at least ${minimum} item(s)`);
  }
  return true;
}

function stringAt(value, path, check) {
  if (typeof value !== "string" || value.length === 0) {
    check.add(path, "must be a non-empty string");
    return false;
  }
  return true;
}

function validateDateTime(value, path, check, nullable = false) {
  if (nullable && value === null) return;
  if (!isDateTime(value)) check.add(path, "must be an RFC 3339 date-time");
}

function validateSource(source, path, check) {
  if (!objectAt(source, path, check)) return;
  if (!isUrl(source.url)) check.add(`${path}/url`, "must be an absolute URI");
  if ("route" in source && typeof source.route !== "string") {
    check.add(`${path}/route`, "must be a string");
  }
  if ("routes" in source) {
    if (arrayAt(source.routes, `${path}/routes`, check, 1)) {
      const routes = new Set();
      source.routes.forEach((route, index) => {
        if (typeof route !== "string") {
          check.add(`${path}/routes/${index}`, "must be a string");
        } else if (routes.has(route)) {
          check.add(`${path}/routes/${index}`, "must be unique");
        }
        routes.add(route);
      });
    }
  }
}

function validateViewport(viewport, path, check) {
  if (!objectAt(viewport, path, check)) return;
  for (const key of ["width", "height"]) {
    if (!Number.isInteger(viewport[key]) || viewport[key] < 1) {
      check.add(`${path}/${key}`, "must be a positive integer");
    }
  }
  if (typeof viewport.deviceScaleFactor !== "number" || viewport.deviceScaleFactor <= 0) {
    check.add(`${path}/deviceScaleFactor`, "must be a positive number");
  }
  if (!["no-preference", "reduce"].includes(viewport.reducedMotion)) {
    check.add(
      `${path}/reducedMotion`,
      "must be no-preference or reduce",
    );
  }
  if (!["light", "dark", "no-preference"].includes(viewport.colorScheme)) {
    check.add(
      `${path}/colorScheme`,
      "must be light, dark, or no-preference",
    );
  }
  if (typeof viewport.hasTouch !== "boolean") {
    check.add(`${path}/hasTouch`, "must be a boolean");
  }
}

function validateUnknown(unknown, path, check) {
  if (!objectAt(unknown, path, check)) return;
  if (!stringAt(unknown.id, `${path}/id`, check) || !SLUG.test(unknown.id)) {
    check.add(`${path}/id`, "must be a lowercase hyphenated slug");
  }
  stringAt(unknown.question, `${path}/question`, check);
  stringAt(unknown.impact, `${path}/impact`, check);
  if (!UNKNOWN_STATUSES.has(unknown.status)) {
    check.add(`${path}/status`, "must be open, accepted, or resolved");
  }
  if (unknown.status === "resolved" && !stringAt(unknown.resolution, `${path}/resolution`, check)) {
    check.add(`${path}/resolution`, "is required when status is resolved");
  }
}

function validateUnknowns(unknowns, path, check) {
  if (!arrayAt(unknowns, path, check)) return;
  unknowns.forEach((unknown, index) => validateUnknown(unknown, `${path}/${index}`, check));
}

function validateEvidenceSource(source, path, check) {
  if (!objectAt(source, path, check)) return;
  if (!isUrl(source.url)) check.add(`${path}/url`, "must be an absolute URI");
  validateDateTime(source.capturedAt, `${path}/capturedAt`, check);
  validateViewport(source.viewport, `${path}/viewport`, check);
  stringAt(source.scenario, `${path}/scenario`, check);
}

function validateEvidence(evidence, path, check, requireSource) {
  if (!objectAt(evidence, path, check)) return;
  if (!EVIDENCE_LEVELS.has(evidence.level)) {
    check.add(`${path}/level`, "must be measured, observed, inferred, or invented");
  }
  stringAt(evidence.claim, `${path}/claim`, check);
  if (requireSource) {
    validateEvidenceSource(evidence.source, `${path}/source`, check);
  }
  if (evidence.level === "measured" && "measurement" in evidence) {
    if (objectAt(evidence.measurement, `${path}/measurement`, check)) {
      stringAt(evidence.measurement.name, `${path}/measurement/name`, check);
      stringAt(evidence.measurement.unit, `${path}/measurement/unit`, check);
      if (!["string", "number", "boolean"].includes(typeof evidence.measurement.value)) {
        check.add(`${path}/measurement/value`, "must be a string, number, or boolean");
      }
    }
  }
}

function validateCaptureInternal(capture, path, check) {
  if (!objectAt(capture, path, check)) return;
  if (capture.schemaVersion !== SCHEMA_VERSION) {
    check.add(`${path}/schemaVersion`, `must equal ${SCHEMA_VERSION}`);
  }
  stringAt(capture.adapter, `${path}/adapter`, check);
  validateSource(capture.source, `${path}/source`, check);
  validateDateTime(capture.capturedAt, `${path}/capturedAt`, check);
  validateViewport(capture.viewport, `${path}/viewport`, check);
  stringAt(capture.scenario, `${path}/scenario`, check);
  if (!EVIDENCE_LEVELS.has(capture.evidenceLevel)) {
    check.add(`${path}/evidenceLevel`, "must be a supported evidence level");
  }
  if (!arrayAt(capture.styleProperties, `${path}/styleProperties`, check, 1)) return;
  if (!objectAt(capture.document, `${path}/document`, check)) return;
  arrayAt(capture.breakpoints, `${path}/breakpoints`, check);
  if (Array.isArray(capture.breakpoints)) {
    capture.breakpoints.forEach((breakpoint, index) => {
      const breakpointPath = `${path}/breakpoints/${index}`;
      if (!objectAt(breakpoint, breakpointPath, check)) return;
      stringAt(breakpoint.query, `${breakpointPath}/query`, check);
      if (typeof breakpoint.matches !== "boolean") {
        check.add(`${breakpointPath}/matches`, "must be a boolean");
      }
    });
  }

  if (arrayAt(capture.nodes, `${path}/nodes`, check)) {
    const ids = new Set();
    capture.nodes.forEach((node, index) => {
      const nodePath = `${path}/nodes/${index}`;
      if (!objectAt(node, nodePath, check)) return;
      if (!Number.isInteger(node.id) || node.id < 0) {
        check.add(`${nodePath}/id`, "must be a non-negative integer");
      } else if (ids.has(node.id)) {
        check.add(`${nodePath}/id`, "must be unique within the capture");
      } else {
        ids.add(node.id);
      }
      if (node.parent !== null && (!Number.isInteger(node.parent) || !ids.has(node.parent))) {
        check.add(`${nodePath}/parent`, "must be null or reference an earlier node id");
      }
      stringAt(node.selector, `${nodePath}/selector`, check);
      stringAt(node.tag, `${nodePath}/tag`, check);
      if (!isObject(node.attributes)) check.add(`${nodePath}/attributes`, "must be an object");
      if (isObject(node.attributes)) {
        for (const [attribute, value] of Object.entries(node.attributes)) {
          if (typeof value !== "string") {
            check.add(`${nodePath}/attributes/${attribute}`, "must be a string");
          }
        }
      }
      if (typeof node.text !== "string") check.add(`${nodePath}/text`, "must be a string");
      if (typeof node.visible !== "boolean") check.add(`${nodePath}/visible`, "must be a boolean");
      if (!isObject(node.rect)) {
        check.add(`${nodePath}/rect`, "must be an object");
      } else {
        for (const key of ["x", "y", "width", "height"]) {
          if (typeof node.rect[key] !== "number" || !Number.isFinite(node.rect[key])) {
            check.add(`${nodePath}/rect/${key}`, "must be a finite number");
          }
        }
      }
      if (!Array.isArray(node.style)) {
        check.add(`${nodePath}/style`, "must be an array");
      } else if (node.style.length !== capture.styleProperties.length) {
        check.add(`${nodePath}/style`, "must align one-to-one with styleProperties");
      }
      if (isObject(node.pseudo)) {
        for (const pseudoName of ["before", "after"]) {
          if (!(pseudoName in node.pseudo)) continue;
          const pseudoPath = `${nodePath}/pseudo/${pseudoName}/style`;
          const pseudoStyle = node.pseudo[pseudoName]?.style;
          if (!Array.isArray(pseudoStyle) || pseudoStyle.length !== capture.styleProperties.length) {
            check.add(pseudoPath, "must align one-to-one with styleProperties");
          }
        }
      }
    });
  }

  if (arrayAt(capture.states, `${path}/states`, check)) {
    capture.states.forEach((state, index) => {
      const statePath = `${path}/states/${index}`;
      if (!objectAt(state, statePath, check)) return;
      stringAt(state.selector, `${statePath}/selector`, check);
      if (arrayAt(state.values, `${statePath}/values`, check, 1)) {
        const values = new Set(state.values);
        if (values.size !== state.values.length) {
          check.add(`${statePath}/values`, "must contain unique state labels");
        }
      }
    });
  }

  if (arrayAt(capture.assets, `${path}/assets`, check)) {
    capture.assets.forEach((asset, index) => {
      const assetPath = `${path}/assets/${index}`;
      if (!objectAt(asset, assetPath, check)) return;
      if (!ASSET_KINDS.has(asset.kind)) {
        check.add(`${assetPath}/kind`, "must be a supported asset kind");
      }
      if ("level" in asset && !EVIDENCE_LEVELS.has(asset.level)) {
        check.add(`${assetPath}/level`, "must be a supported evidence level");
      }
    });
  }

  if (objectAt(capture.telemetry, `${path}/telemetry`, check)) {
    if (!objectAt(capture.telemetry.scroll, `${path}/telemetry/scroll`, check)) return;
    for (const key of ["resources", "animations", "media", "canvas", "webgl"]) {
      arrayAt(capture.telemetry[key], `${path}/telemetry/${key}`, check);
    }
    if (Array.isArray(capture.telemetry.resources)) {
      capture.telemetry.resources.forEach((resource, index) => {
        const resourcePath = `${path}/telemetry/resources/${index}`;
        if (!objectAt(resource, resourcePath, check)) return;
        if (typeof resource.name !== "string") {
          check.add(`${resourcePath}/name`, "must be a string");
        }
        if (typeof resource.initiatorType !== "string") {
          check.add(`${resourcePath}/initiatorType`, "must be a string");
        }
      });
    }
  }
  validateUnknowns(capture.unknowns, `${path}/unknowns`, check);
}

export function validateCapture(capture) {
  const check = collector();
  validateCaptureInternal(capture, "", check);
  return combineValidation(
    validateAgainstSchema(capture, CAPTURE_SCHEMA),
    check.result(),
  );
}

export function validateSiteInspection(artifact) {
  const check = collector();
  if (!objectAt(artifact, "", check)) return check.result();
  if (artifact.schemaVersion !== SCHEMA_VERSION) {
    check.add("/schemaVersion", `must equal ${SCHEMA_VERSION}`);
  }
  if (!stringAt(artifact.target, "/target", check) || !SLUG.test(artifact.target)) {
    check.add("/target", "must be a lowercase hyphenated slug");
  }
  if (arrayAt(artifact.captures, "/captures", check, 1)) {
    artifact.captures.forEach((capture, index) =>
      validateCaptureInternal(capture, `/captures/${index}`, check)
    );
  }
  if (arrayAt(artifact.findings, "/findings", check)) {
    artifact.findings.forEach((finding, index) =>
      validateEvidence(finding, `/findings/${index}`, check, true)
    );
  }
  validateUnknowns(artifact.unknowns, "/unknowns", check);
  return combineValidation(
    validateAgainstSchema(artifact, SITE_INSPECTION_SCHEMA),
    check.result(),
  );
}

function validateScenario(scenario, path, check) {
  if (!objectAt(scenario, path, check)) return;
  if (!stringAt(scenario.id, `${path}/id`, check) || !SLUG.test(scenario.id)) {
    check.add(`${path}/id`, "must be a lowercase hyphenated slug");
  }
  stringAt(scenario.route, `${path}/route`, check);
  if (!SCENARIO_FAMILIES.has(scenario.family)) {
    check.add(`${path}/family`, "must be a supported scenario family");
  }
  validateViewport(scenario.viewport, `${path}/viewport`, check);
  if (arrayAt(scenario.states, `${path}/states`, check)) {
    const states = new Set();
    scenario.states.forEach((state, index) => {
      if (typeof state !== "string" || state.length === 0) {
        check.add(`${path}/states/${index}`, "must be a non-empty string");
      } else if (states.has(state)) {
        check.add(`${path}/states/${index}`, "must be unique");
      }
      states.add(state);
    });
  }
  if (arrayAt(scenario.preconditions, `${path}/preconditions`, check)) {
    scenario.preconditions.forEach((precondition, index) => {
      if (typeof precondition !== "string") {
        check.add(`${path}/preconditions/${index}`, "must be a string");
      }
    });
  }

  const stepIds = new Set();
  if (arrayAt(scenario.steps, `${path}/steps`, check, 1)) {
    scenario.steps.forEach((step, index) => {
      const stepPath = `${path}/steps/${index}`;
      if (!objectAt(step, stepPath, check)) return;
      if (!stringAt(step.id, `${stepPath}/id`, check) || !SLUG.test(step.id)) {
        check.add(`${stepPath}/id`, "must be a lowercase hyphenated slug");
      } else if (stepIds.has(step.id)) {
        check.add(`${stepPath}/id`, "must be unique within the scenario");
      } else {
        stepIds.add(step.id);
      }
      if (!STEP_ACTIONS.has(step.action)) {
        check.add(`${stepPath}/action`, "must be a supported step action");
      }
    });
  }

  if (arrayAt(scenario.captures, `${path}/captures`, check, 1)) {
    const captureIds = new Set();
    scenario.captures.forEach((capture, index) => {
      const capturePath = `${path}/captures/${index}`;
      if (!objectAt(capture, capturePath, check)) return;
      if (!stringAt(capture.id, `${capturePath}/id`, check) || !SLUG.test(capture.id)) {
        check.add(`${capturePath}/id`, "must be a lowercase hyphenated slug");
      } else if (captureIds.has(capture.id)) {
        check.add(`${capturePath}/id`, "must be unique within the scenario");
      } else {
        captureIds.add(capture.id);
      }
      if (!CAPTURE_KINDS.has(capture.kind)) {
        check.add(`${capturePath}/kind`, "must be a supported capture kind");
      }
      stringAt(capture.path, `${capturePath}/path`, check);
      if ("afterStep" in capture && !stepIds.has(capture.afterStep)) {
        check.add(`${capturePath}/afterStep`, "must reference a step id in this scenario");
      }
    });
  }

  if (!SCENARIO_STATUSES.has(scenario.status)) {
    check.add(`${path}/status`, "must be a supported scenario status");
  }
  validateDateTime(scenario.capturedAt, `${path}/capturedAt`, check, true);
  if (["captured", "verified"].includes(scenario.status) && scenario.capturedAt === null) {
    check.add(`${path}/capturedAt`, "is required when status is captured or verified");
  }

  if (objectAt(scenario.resume, `${path}/resume`, check)) {
    if (arrayAt(scenario.resume.completedStepIds, `${path}/resume/completedStepIds`, check)) {
      scenario.resume.completedStepIds.forEach((id, index) => {
        if (!stepIds.has(id)) {
          check.add(
            `${path}/resume/completedStepIds/${index}`,
            "must reference a step id in this scenario"
          );
        }
      });
    }
    if (
      scenario.resume.nextStepId !== null &&
      scenario.resume.nextStepId !== undefined &&
      !stepIds.has(scenario.resume.nextStepId)
    ) {
      check.add(`${path}/resume/nextStepId`, "must reference a step id in this scenario");
    }
  }

  if (arrayAt(scenario.attempts, `${path}/attempts`, check)) {
    scenario.attempts.forEach((attempt, index) => {
      const attemptPath = `${path}/attempts/${index}`;
      if (!objectAt(attempt, attemptPath, check)) return;
      stringAt(attempt.adapter, `${attemptPath}/adapter`, check);
      validateDateTime(attempt.startedAt, `${attemptPath}/startedAt`, check);
      if ("endedAt" in attempt) {
        validateDateTime(attempt.endedAt, `${attemptPath}/endedAt`, check, true);
      }
      if (!ATTEMPT_STATUSES.has(attempt.status)) {
        check.add(`${attemptPath}/status`, "must be a supported attempt status");
      }
      if (
        attempt.status !== "in_progress" &&
        (!("endedAt" in attempt) || attempt.endedAt === null)
      ) {
        check.add(`${attemptPath}/endedAt`, "is required for a completed attempt");
      }
      if (arrayAt(attempt.completedStepIds, `${attemptPath}/completedStepIds`, check)) {
        attempt.completedStepIds.forEach((id, stepIndex) => {
          if (!stepIds.has(id)) {
            check.add(
              `${attemptPath}/completedStepIds/${stepIndex}`,
              "must reference a step id in this scenario"
            );
          }
        });
      }
      arrayAt(attempt.artifactPaths, `${attemptPath}/artifactPaths`, check);
    });
  }
  if (arrayAt(scenario.evidence, `${path}/evidence`, check)) {
    scenario.evidence.forEach((evidence, index) =>
      validateEvidence(evidence, `${path}/evidence/${index}`, check, false)
    );
  }
  validateUnknowns(scenario.unknowns, `${path}/unknowns`, check);
}

export function validateCaptureScenarios(artifact) {
  const check = collector();
  if (!objectAt(artifact, "", check)) return check.result();
  if (artifact.schemaVersion !== SCHEMA_VERSION) {
    check.add("/schemaVersion", `must equal ${SCHEMA_VERSION}`);
  }
  if (!stringAt(artifact.target, "/target", check) || !SLUG.test(artifact.target)) {
    check.add("/target", "must be a lowercase hyphenated slug");
  }
  validateSource(artifact.source, "/source", check);
  validateDateTime(artifact.createdAt, "/createdAt", check);
  validateDateTime(artifact.updatedAt, "/updatedAt", check);
  if (
    isDateTime(artifact.createdAt) &&
    isDateTime(artifact.updatedAt) &&
    Date.parse(artifact.updatedAt) < Date.parse(artifact.createdAt)
  ) {
    check.add("/updatedAt", "must not be earlier than createdAt");
  }
  if (arrayAt(artifact.scenarios, "/scenarios", check, 1)) {
    const ids = new Set();
    artifact.scenarios.forEach((scenario, index) => {
      validateScenario(scenario, `/scenarios/${index}`, check);
      if (isObject(scenario) && typeof scenario.id === "string") {
        if (ids.has(scenario.id)) {
          check.add(`/scenarios/${index}/id`, "must be unique within the artifact");
        }
        ids.add(scenario.id);
      }
    });
  }
  validateUnknowns(artifact.unknowns, "/unknowns", check);
  return combineValidation(
    validateAgainstSchema(artifact, CAPTURE_SCENARIOS_SCHEMA),
    check.result(),
  );
}

export function detectArtifactKind(artifact) {
  if (!isObject(artifact)) return null;
  if (Array.isArray(artifact.scenarios)) return "capture-scenarios";
  if (Array.isArray(artifact.captures)) return "site-inspection";
  if (
    typeof artifact.scenario === "string" &&
    Array.isArray(artifact.nodes) &&
    isObject(artifact.telemetry)
  ) {
    return "capture";
  }
  return null;
}

export function formatErrors(errors) {
  return errors.map((error) => `${error.path || "/"}: ${error.message}`).join("\n");
}

function captureKey(capture) {
  const route = capture.source.route ?? "";
  const viewport = capture.viewport;
  return [
    capture.scenario,
    `${viewport.width}x${viewport.height}@${viewport.deviceScaleFactor}`,
    capture.source.url,
    route
  ].join("|");
}

export function mergeSiteInspection(existing, target, incomingCaptures) {
  if (!SLUG.test(target)) throw new Error("target must be a lowercase hyphenated slug");
  const captures = new Map();
  const findings = [];
  const unknowns = [];
  if (existing !== null) {
    const result = validateSiteInspection(existing);
    if (!result.valid) {
      throw new Error(`existing site inspection is invalid:\n${formatErrors(result.errors)}`);
    }
    if (existing.target !== target) {
      throw new Error(`existing target ${existing.target} does not match ${target}`);
    }
    for (const capture of existing.captures) captures.set(captureKey(capture), capture);
    findings.push(...existing.findings);
    unknowns.push(...existing.unknowns);
  }
  for (const capture of incomingCaptures) {
    const result = validateCapture(capture);
    if (!result.valid) {
      throw new Error(`incoming capture is invalid:\n${formatErrors(result.errors)}`);
    }
    captures.set(captureKey(capture), capture);
  }
  return {
    $schema: "../schemas/site-inspection.schema.json",
    schemaVersion: SCHEMA_VERSION,
    target,
    captures: [...captures.values()].sort(
      (left, right) =>
        left.scenario.localeCompare(right.scenario) ||
        left.viewport.width - right.viewport.width ||
        left.viewport.height - right.viewport.height ||
        left.source.url.localeCompare(right.source.url) ||
        left.capturedAt.localeCompare(right.capturedAt)
    ),
    findings,
    unknowns
  };
}

export { EVIDENCE_LEVELS, SCHEMA_VERSION };
