#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  statSync,
} from "node:fs";
import { resolve } from "node:path";
import {
  printError,
  sha256File,
  valueAfter,
} from "./lib.mjs";
import { validateAgainstSchema } from "./json-schema.mjs";

const EVIDENCE_LEVELS = new Set([
  "measured",
  "observed",
  "inferred",
  "invented",
]);
const EVENT_MODES = new Set(["continuous", "discrete"]);
const SOURCE_KINDS = new Set([
  "source-video",
  "deterministic-recording",
  "contact-sheet",
  "screenshot",
  "telemetry",
  "other",
]);
const TELEMETRY_KINDS = new Set([
  "dom",
  "scroll",
  "media",
  "canvas",
  "webgl",
  "network",
  "actions",
  "synchronization",
]);
const TELEMETRY_CLOCKS = new Set([
  "performance",
  "video",
  "media",
  "wall",
  "mixed",
]);
const TRIGGER_TYPES = new Set([
  "load",
  "time",
  "scroll-position",
  "scroll-progress",
  "intersection",
  "hover",
  "focus",
  "pointer",
  "click",
  "media-time",
  "resize",
  "custom",
]);
const REDUCED_MOTION_BEHAVIORS = new Set([
  "preserve-essential-state",
  "shorten",
  "disable",
  "replace",
  "unknown",
]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function usage() {
  process.stdout.write(
    [
      "Usage: validate-motion-manifest.mjs <manifest.json> [options]",
      "  --schema <schema.json>  Schema path (default docs/research/schemas/motion-manifest.schema.json)",
      "  --root <directory>      Base for relative artifact paths (default current directory)",
      "  --check-artifacts       Verify artifact existence, sizes, and declared hashes",
      "",
    ].join("\n"),
  );
}

function parseArgs(args) {
  const options = {
    root: process.cwd(),
    schema: joinDefaultSchema(),
    checkArtifacts: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--check-artifacts") {
      options.checkArtifacts = true;
      continue;
    }
    if (arg === "--schema" || arg === "--root") {
      options[arg === "--schema" ? "schema" : "root"] = valueAfter(args, index, arg);
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`unknown option: ${arg}`);
    }
    if (options.manifest) {
      throw new Error(`unexpected argument: ${arg}`);
    }
    options.manifest = arg;
  }

  if (!options.manifest) {
    throw new Error("manifest path is required");
  }
  return options;
}

function joinDefaultSchema() {
  return resolve(
    process.cwd(),
    "docs",
    "research",
    "schemas",
    "motion-manifest.schema.json",
  );
}

function parseJson(filePath, label) {
  const absolutePath = resolve(filePath);
  let text;
  try {
    text = readFileSync(absolutePath, "utf8");
  } catch {
    throw new Error(`${label} not found: ${absolutePath}`);
  }

  try {
    return { absolutePath, value: JSON.parse(text) };
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isTimestamp(value) {
  return isNonEmptyString(value)
    && /T/.test(value)
    && Number.isFinite(Date.parse(value));
}

function addRequiredProblems(value, keys, at, problems) {
  if (!isObject(value)) {
    problems.push(`${at} must be an object`);
    return false;
  }
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) {
      problems.push(`${at}.${key} is required`);
    }
  }
  return true;
}

function addIdProblems(items, at, problems) {
  const ids = new Set();
  if (!Array.isArray(items)) {
    problems.push(`${at} must be an array`);
    return ids;
  }

  items.forEach((item, index) => {
    const itemPath = `${at}[${index}]`;
    if (!isObject(item) || !isNonEmptyString(item.id)) {
      problems.push(`${itemPath}.id must be a non-empty string`);
      return;
    }
    if (ids.has(item.id)) {
      problems.push(`${itemPath}.id duplicates "${item.id}"`);
    }
    ids.add(item.id);
  });
  return ids;
}

function validateViewport(viewport, at, problems) {
  if (!addRequiredProblems(viewport, ["width", "height"], at, problems)) {
    return;
  }
  if (!Number.isInteger(viewport.width) || viewport.width < 1) {
    problems.push(`${at}.width must be a positive integer`);
  }
  if (!Number.isInteger(viewport.height) || viewport.height < 1) {
    problems.push(`${at}.height must be a positive integer`);
  }
}

function validateEvidence(evidence, at, problems, evidenceIds, artifacts) {
  if (!addRequiredProblems(evidence, ["level", "claim", "source"], at, problems)) {
    return;
  }
  if (!EVIDENCE_LEVELS.has(evidence.level)) {
    problems.push(`${at}.level must be measured, observed, inferred, or invented`);
  }
  if (!isNonEmptyString(evidence.claim)) {
    problems.push(`${at}.claim must be a non-empty string`);
  }

  const sourcePath = `${at}.source`;
  if (
    addRequiredProblems(
      evidence.source,
      ["sourceId", "capturedAt", "viewport", "scenario", "artifact"],
      sourcePath,
      problems,
    )
  ) {
    if (!evidenceIds.has(evidence.source.sourceId)) {
      problems.push(
        `${sourcePath}.sourceId references unknown evidence source "${evidence.source.sourceId}"`,
      );
    }
    if (!isTimestamp(evidence.source.capturedAt)) {
      problems.push(`${sourcePath}.capturedAt must be an ISO date-time`);
    }
    validateViewport(evidence.source.viewport, `${sourcePath}.viewport`, problems);
    if (!isNonEmptyString(evidence.source.scenario)) {
      problems.push(`${sourcePath}.scenario must be a non-empty string`);
    }
    if (!isNonEmptyString(evidence.source.artifact)) {
      problems.push(`${sourcePath}.artifact must be a non-empty path`);
    } else {
      artifacts.push({
        path: evidence.source.artifact,
        label: `${sourcePath}.artifact`,
      });
    }
    if (
      evidence.source.scrollProgress !== undefined
      && (
        !isFiniteNumber(evidence.source.scrollProgress)
        || evidence.source.scrollProgress < 0
        || evidence.source.scrollProgress > 1
      )
    ) {
      problems.push(`${sourcePath}.scrollProgress must be from 0 to 1`);
    }
  }

  if (evidence.level === "measured" && !isObject(evidence.measurement)) {
    problems.push(`${at}.measurement is required when level is measured`);
  }
  if (evidence.measurement !== undefined) {
    const measurementPath = `${at}.measurement`;
    if (
      addRequiredProblems(
        evidence.measurement,
        ["name", "value", "unit"],
        measurementPath,
        problems,
      )
    ) {
      if (!isNonEmptyString(evidence.measurement.name)) {
        problems.push(`${measurementPath}.name must be a non-empty string`);
      }
      if (!isFiniteNumber(evidence.measurement.value)) {
        problems.push(`${measurementPath}.value must be a finite number`);
      }
      if (!isNonEmptyString(evidence.measurement.unit)) {
        problems.push(`${measurementPath}.unit must be a non-empty string`);
      }
    }
  }
}

function validateState(state, at, problems) {
  if (!addRequiredProblems(state, ["label", "properties"], at, problems)) {
    return;
  }
  if (!isNonEmptyString(state.label)) {
    problems.push(`${at}.label must be a non-empty string`);
  }
  if (!Array.isArray(state.properties) || state.properties.length === 0) {
    problems.push(`${at}.properties must be a non-empty array`);
    return;
  }
  state.properties.forEach((property, index) => {
    const propertyPath = `${at}.properties[${index}]`;
    if (
      addRequiredProblems(
        property,
        ["target", "property", "value"],
        propertyPath,
        problems,
      )
    ) {
      if (!isNonEmptyString(property.target)) {
        problems.push(`${propertyPath}.target must be a non-empty string`);
      }
      if (!isNonEmptyString(property.property)) {
        problems.push(`${propertyPath}.property must be a non-empty string`);
      }
    }
  });
}

function validateEvent(
  event,
  index,
  problems,
  evidenceIds,
  telemetryIds,
  unknownIds,
  artifacts,
) {
  const at = `events[${index}]`;
  const required = [
    "id",
    "label",
    "mode",
    "evidence",
    "trigger",
    "stateA",
    "stateB",
    "timing",
    "telemetryRefs",
    "unknownRefs",
  ];
  if (!addRequiredProblems(event, required, at, problems)) {
    return;
  }
  if (!EVENT_MODES.has(event.mode)) {
    problems.push(`${at}.mode must be continuous or discrete`);
  }
  if (!isObject(event.time) && !isObject(event.scroll)) {
    problems.push(`${at} must define time, scroll, or both`);
  }
  if (isObject(event.time)) {
    if (
      !isFiniteNumber(event.time.startSeconds)
      || !isFiniteNumber(event.time.endSeconds)
      || event.time.startSeconds < 0
      || event.time.endSeconds < event.time.startSeconds
    ) {
      problems.push(`${at}.time must have 0 <= startSeconds <= endSeconds`);
    }
  }
  if (isObject(event.scroll)) {
    if (!isNonEmptyString(event.scroll.container)) {
      problems.push(`${at}.scroll.container must be a non-empty string`);
    }
    if (!["x", "y"].includes(event.scroll.axis)) {
      problems.push(`${at}.scroll.axis must be x or y`);
    }
    const hasPx = isFiniteNumber(event.scroll.startPx)
      && isFiniteNumber(event.scroll.endPx);
    const hasProgress = isFiniteNumber(event.scroll.startProgress)
      && isFiniteNumber(event.scroll.endProgress);
    if (!hasPx && !hasProgress) {
      problems.push(`${at}.scroll requires a complete px or progress range`);
    }
    if (
      hasProgress
      && (
        event.scroll.startProgress < 0
        || event.scroll.endProgress > 1
        || event.scroll.endProgress < event.scroll.startProgress
      )
    ) {
      problems.push(`${at}.scroll progress must be ordered within 0 and 1`);
    }
  }

  validateEvidence(event.evidence, `${at}.evidence`, problems, evidenceIds, artifacts);
  validateState(event.stateA, `${at}.stateA`, problems);
  validateState(event.stateB, `${at}.stateB`, problems);

  if (!isObject(event.trigger) || !isNonEmptyString(event.trigger.type)) {
    problems.push(`${at}.trigger.type must be a non-empty string`);
  } else if (!TRIGGER_TYPES.has(event.trigger.type)) {
    problems.push(`${at}.trigger.type is not supported`);
  } else if (
    event.trigger.telemetryRef
    && !telemetryIds.has(event.trigger.telemetryRef)
  ) {
    problems.push(`${at}.trigger.telemetryRef references unknown telemetry`);
  }
  if (!isObject(event.timing)) {
    problems.push(`${at}.timing must be an object`);
  } else if (
    event.mode === "discrete"
    && !isFiniteNumber(event.timing.durationMs)
    && (!Array.isArray(event.unknownRefs) || event.unknownRefs.length === 0)
  ) {
    problems.push(
      `${at}.timing.durationMs is required for a discrete event unless an unknown is referenced`,
    );
  }

  if (!Array.isArray(event.telemetryRefs)) {
    problems.push(`${at}.telemetryRefs must be an array`);
  }
  if (!Array.isArray(event.unknownRefs)) {
    problems.push(`${at}.unknownRefs must be an array`);
  }
  for (const telemetryRef of arrayOrEmpty(event.telemetryRefs)) {
    if (!telemetryIds.has(telemetryRef)) {
      problems.push(`${at}.telemetryRefs references unknown "${telemetryRef}"`);
    }
  }
  for (const unknownRef of arrayOrEmpty(event.unknownRefs)) {
    if (!unknownIds.has(unknownRef)) {
      problems.push(`${at}.unknownRefs references unknown "${unknownRef}"`);
    }
  }
}

function validateFallbackEvidence(
  fallback,
  at,
  problems,
  evidenceIds,
  eventIds,
  artifacts,
) {
  if (!isObject(fallback)) {
    problems.push(`${at} must be an object`);
    return;
  }
  validateEvidence(fallback.evidence, `${at}.evidence`, problems, evidenceIds, artifacts);
  if (fallback.eventRefs !== undefined && !Array.isArray(fallback.eventRefs)) {
    problems.push(`${at}.eventRefs must be an array`);
  }
  for (const eventRef of arrayOrEmpty(fallback.eventRefs)) {
    if (!eventIds.has(eventRef)) {
      problems.push(`${at}.eventRefs references unknown "${eventRef}"`);
    }
  }
}

export async function validateManifest(manifest, options) {
  const problems = [];
  const artifacts = [];
  const root = resolve(options.root);
  const required = [
    "schemaVersion",
    "target",
    "sources",
    "telemetry",
    "events",
    "responsiveFallbacks",
    "reducedMotionFallback",
    "unknowns",
    "implementationReading",
    "qaCheckpoints",
  ];
  if (!addRequiredProblems(manifest, required, "manifest", problems)) {
    return { problems, checkedArtifacts: 0 };
  }

  if (manifest.schemaVersion !== "1.0.0") {
    problems.push('manifest.schemaVersion must equal "1.0.0"');
  }

  if (
    addRequiredProblems(
      manifest.target,
      ["slug", "url", "capturedAt", "scenario", "viewport"],
      "target",
      problems,
    )
  ) {
    if (!isNonEmptyString(manifest.target.slug)) {
      problems.push("target.slug must be a non-empty string");
    }
    if (!isNonEmptyString(manifest.target.url)) {
      problems.push("target.url must be a non-empty URI");
    }
    if (!isNonEmptyString(manifest.target.scenario)) {
      problems.push("target.scenario must be a non-empty string");
    }
    if (!isTimestamp(manifest.target.capturedAt)) {
      problems.push("target.capturedAt must be an ISO date-time");
    }
    validateViewport(manifest.target.viewport, "target.viewport", problems);
  }

  const sourceIds = addIdProblems(manifest.sources, "sources", problems);
  if (Array.isArray(manifest.sources) && manifest.sources.length === 0) {
    problems.push("sources must contain at least one source");
  }
  for (const [index, source] of arrayOrEmpty(manifest.sources).entries()) {
    const at = `sources[${index}]`;
    if (!isObject(source)) {
      continue;
    }
    if (!SOURCE_KINDS.has(source.kind)) {
      problems.push(`${at}.kind is not a supported source kind`);
    }
    if (!isNonEmptyString(source.path) && !isNonEmptyString(source.url)) {
      problems.push(`${at} requires path or url`);
    }
    if (!SHA256_PATTERN.test(source.sha256 ?? "")) {
      problems.push(`${at}.sha256 must be a lowercase SHA-256 digest`);
    }
    if (!Number.isInteger(source.bytes) || source.bytes < 0) {
      problems.push(`${at}.bytes must be a non-negative integer`);
    }
    if (source.path) {
      artifacts.push({
        path: source.path,
        hash: source.sha256,
        bytes: source.bytes,
        label: `${at}.path`,
      });
    }
  }

  const telemetryIds = addIdProblems(manifest.telemetry, "telemetry", problems);
  for (const [index, telemetry] of arrayOrEmpty(manifest.telemetry).entries()) {
    const at = `telemetry[${index}]`;
    if (!isObject(telemetry)) {
      continue;
    }
    if (!TELEMETRY_KINDS.has(telemetry.kind)) {
      problems.push(`${at}.kind is not a supported telemetry channel`);
    }
    if (!TELEMETRY_CLOCKS.has(telemetry.clock)) {
      problems.push(`${at}.clock is not a supported clock`);
    }
    if (!isNonEmptyString(telemetry.artifact)) {
      problems.push(`${at}.artifact must be a non-empty path`);
    } else {
      artifacts.push({
        path: telemetry.artifact,
        hash: telemetry.sha256,
        label: `${at}.artifact`,
      });
    }
    if (!SHA256_PATTERN.test(telemetry.sha256 ?? "")) {
      problems.push(`${at}.sha256 must be a lowercase SHA-256 digest`);
    }
    if (!isTimestamp(telemetry.capturedAt)) {
      problems.push(`${at}.capturedAt must be an ISO date-time`);
    }
  }

  const unknownIds = addIdProblems(manifest.unknowns, "unknowns", problems);
  const eventIds = addIdProblems(manifest.events, "events", problems);
  if (Array.isArray(manifest.events) && manifest.events.length === 0) {
    problems.push("events must contain at least one motion event");
  }
  const evidenceIds = new Set([...sourceIds, ...telemetryIds]);

  for (const [index, event] of arrayOrEmpty(manifest.events).entries()) {
    validateEvent(
      event,
      index,
      problems,
      evidenceIds,
      telemetryIds,
      unknownIds,
      artifacts,
    );
  }

  for (const [index, unknown] of arrayOrEmpty(manifest.unknowns).entries()) {
    const at = `unknowns[${index}]`;
    if (!isObject(unknown)) {
      continue;
    }
    if (!["open", "accepted", "resolved"].includes(unknown.status)) {
      problems.push(`${at}.status must be open, accepted, or resolved`);
    }
    if (!isNonEmptyString(unknown.question) || !isNonEmptyString(unknown.impact)) {
      problems.push(`${at}.question and impact must be non-empty strings`);
    }
    if (!Array.isArray(unknown.eventRefs)) {
      problems.push(`${at}.eventRefs must be an array`);
    }
    if (unknown.status === "resolved" && !isNonEmptyString(unknown.resolution)) {
      problems.push(`${at}.resolution is required when status is resolved`);
    }
    for (const eventRef of arrayOrEmpty(unknown.eventRefs)) {
      if (!eventIds.has(eventRef)) {
        problems.push(`${at}.eventRefs references unknown "${eventRef}"`);
      }
    }
  }

  if (
    !Array.isArray(manifest.responsiveFallbacks)
    || manifest.responsiveFallbacks.length === 0
  ) {
    problems.push("responsiveFallbacks must contain at least one viewport rule");
  } else {
    manifest.responsiveFallbacks.forEach((fallback, index) => {
      const at = `responsiveFallbacks[${index}]`;
      if (!isNonEmptyString(fallback?.condition)) {
        problems.push(`${at}.condition must be a non-empty string`);
      }
      if (!isNonEmptyString(fallback?.behavior)) {
        problems.push(`${at}.behavior must be a non-empty string`);
      }
      validateFallbackEvidence(
        fallback,
        at,
        problems,
        evidenceIds,
        eventIds,
        artifacts,
      );
    });
  }

  if (!isObject(manifest.reducedMotionFallback)) {
    problems.push("reducedMotionFallback must be an object");
  } else {
    if (!REDUCED_MOTION_BEHAVIORS.has(manifest.reducedMotionFallback.behavior)) {
      problems.push("reducedMotionFallback.behavior is invalid");
    }
    if (!isNonEmptyString(manifest.reducedMotionFallback.details)) {
      problems.push("reducedMotionFallback.details must be a non-empty string");
    }
    validateFallbackEvidence(
      manifest.reducedMotionFallback,
      "reducedMotionFallback",
      problems,
      evidenceIds,
      eventIds,
      artifacts,
    );
  }

  const readingIds = addIdProblems(
    manifest.implementationReading,
    "implementationReading",
    problems,
  );
  if (readingIds.size === 0) {
    problems.push("implementationReading must contain at least one reading");
  }
  for (
    const [index, reading]
    of arrayOrEmpty(manifest.implementationReading).entries()
  ) {
    const at = `implementationReading[${index}]`;
    if (!isObject(reading)) {
      continue;
    }
    if (!EVIDENCE_LEVELS.has(reading.level)) {
      problems.push(`${at}.level is invalid`);
    }
    if (!isNonEmptyString(reading.claim) || !isNonEmptyString(reading.mechanism)) {
      problems.push(`${at}.claim and mechanism must be non-empty strings`);
    }
    if (!Array.isArray(reading.eventRefs) || reading.eventRefs.length === 0) {
      problems.push(`${at}.eventRefs must contain at least one event`);
    }
    if (!Array.isArray(reading.evidenceRefs)) {
      problems.push(`${at}.evidenceRefs must be an array`);
    }
    for (const eventRef of arrayOrEmpty(reading.eventRefs)) {
      if (!eventIds.has(eventRef)) {
        problems.push(`${at}.eventRefs references unknown "${eventRef}"`);
      }
    }
    for (const evidenceRef of arrayOrEmpty(reading.evidenceRefs)) {
      if (!evidenceIds.has(evidenceRef)) {
        problems.push(`${at}.evidenceRefs references unknown "${evidenceRef}"`);
      }
    }
  }

  const checkpointIds = addIdProblems(manifest.qaCheckpoints, "qaCheckpoints", problems);
  if (checkpointIds.size === 0) {
    problems.push("qaCheckpoints must contain at least one checkpoint");
  }
  for (
    const [index, checkpoint]
    of arrayOrEmpty(manifest.qaCheckpoints).entries()
  ) {
    const at = `qaCheckpoints[${index}]`;
    if (!isObject(checkpoint)) {
      continue;
    }
    if (!eventIds.has(checkpoint.eventRef)) {
      problems.push(`${at}.eventRef references unknown "${checkpoint.eventRef}"`);
    }
    if (
      !isObject(checkpoint.at)
      || !["timeSeconds", "scrollPx", "scrollProgress", "state"].some(
        (key) => checkpoint.at[key] !== undefined,
      )
    ) {
      problems.push(`${at}.at must define a time, scroll, progress, or state checkpoint`);
    }
    if (!Array.isArray(checkpoint.expected) || checkpoint.expected.length === 0) {
      problems.push(`${at}.expected must be a non-empty array`);
    } else {
      validateState(
        { label: "expected", properties: checkpoint.expected },
        `${at}.expectedState`,
        problems,
      );
    }
    validateEvidence(
      checkpoint.evidence,
      `${at}.evidence`,
      problems,
      evidenceIds,
      artifacts,
    );
    if (checkpoint.artifact || checkpoint.artifactSha256) {
      if (
        !isNonEmptyString(checkpoint.artifact)
        || !SHA256_PATTERN.test(checkpoint.artifactSha256 ?? "")
      ) {
        problems.push(`${at}.artifact and artifactSha256 must be provided together`);
      } else {
        artifacts.push({
          path: checkpoint.artifact,
          hash: checkpoint.artifactSha256,
          label: `${at}.artifact`,
        });
      }
    }
  }

  let checkedArtifacts = 0;
  if (options.checkArtifacts) {
    const uniqueArtifacts = new Map();
    for (const artifact of artifacts) {
      const absolutePath = resolve(root, artifact.path);
      const existing = uniqueArtifacts.get(absolutePath);
      if (!existing || (!existing.hash && artifact.hash)) {
        uniqueArtifacts.set(absolutePath, artifact);
      }
    }

    for (const [absolutePath, artifact] of uniqueArtifacts) {
      if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
        problems.push(`${artifact.label} not found: ${absolutePath}`);
        continue;
      }
      checkedArtifacts += 1;
      const stat = statSync(absolutePath);
      if (artifact.bytes !== undefined && stat.size !== artifact.bytes) {
        problems.push(
          `${artifact.label} byte size mismatch: expected ${artifact.bytes}, got ${stat.size}`,
        );
      }
      if (artifact.hash) {
        const actualHash = await sha256File(absolutePath);
        if (actualHash !== artifact.hash) {
          problems.push(
            `${artifact.label} SHA-256 mismatch: expected ${artifact.hash}, got ${actualHash}`,
          );
        }
      }
    }
  }

  return { problems, checkedArtifacts };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { value: schema } = parseJson(options.schema, "motion schema");
  if (
    schema.$id !== "https://tenten.co/schemas/motion-manifest.schema.json"
    || schema.properties?.schemaVersion?.const !== "1.0.0"
  ) {
    throw new Error("motion schema has an unexpected id or version");
  }

  const { absolutePath, value: manifest } = parseJson(
    options.manifest,
    "motion manifest",
  );
  const structural = validateAgainstSchema(manifest, schema);
  const result = await validateManifest(manifest, options);
  result.problems.unshift(
    ...structural.errors.map(
      (error) => `${error.path}: ${error.message}`,
    ),
  );
  if (result.problems.length > 0) {
    process.stderr.write(
      `invalid motion manifest: ${absolutePath}\n${result.problems
        .map((problem) => `- ${problem}`)
        .join("\n")}\n`,
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `valid motion manifest: ${absolutePath} `
      + `(${manifest.events.length} events, ${manifest.telemetry.length} telemetry records, `
      + `${result.checkedArtifacts} artifacts checked)\n`,
  );
}

main().catch((error) => {
  printError(error);
  process.exitCode = 1;
});
