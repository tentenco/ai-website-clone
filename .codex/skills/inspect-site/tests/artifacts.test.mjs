import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";
import vm from "node:vm";

import {
  detectArtifactKind,
  mergeSiteInspection,
  validateCapture,
  validateCaptureScenarios,
  validateSiteInspection
} from "../scripts/lib/artifacts.mjs";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const skillDirectory = resolve(testDirectory, "..");
const repositoryRoot = resolve(skillDirectory, "../../..");

async function fixture(name) {
  return JSON.parse(await readFile(resolve(testDirectory, "fixtures", name), "utf8"));
}

describe("artifact validation", () => {
  test("accepts representative site inspection and raw capture artifacts", async () => {
    const siteInspection = await fixture("site-inspection.valid.json");
    const capture = await fixture("capture.valid.json");

    assert.equal(detectArtifactKind(siteInspection), "site-inspection");
    assert.equal(detectArtifactKind(capture), "capture");
    assert.deepEqual(validateSiteInspection(siteInspection), { valid: true, errors: [] });
    assert.deepEqual(validateCapture(capture), { valid: true, errors: [] });
  });

  test("rejects malformed source, evidence, viewport, and style alignment", async () => {
    const artifact = await fixture("site-inspection.invalid.json");
    const result = validateSiteInspection(artifact);
    const paths = result.errors.map((error) => error.path);

    assert.equal(result.valid, false);
    assert(paths.includes("/schemaVersion"));
    assert(paths.includes("/captures/0/source/url"));
    assert(paths.includes("/captures/0/viewport/width"));
    assert(paths.includes("/captures/0/evidenceLevel"));
    assert(paths.includes("/captures/0/nodes/0/style"));
    assert(paths.includes("/findings/0/level"));
  });

  test("validates resumable capture scenarios and their references", async () => {
    const valid = await fixture("capture-scenarios.valid.json");
    const invalid = await fixture("capture-scenarios.invalid.json");
    const invalidResult = validateCaptureScenarios(invalid);
    const messages = invalidResult.errors.map((error) => `${error.path} ${error.message}`).join("\n");

    assert.equal(detectArtifactKind(valid), "capture-scenarios");
    assert.deepEqual(validateCaptureScenarios(valid), { valid: true, errors: [] });
    assert.equal(invalidResult.valid, false);
    assert.match(messages, /updatedAt/);
    assert.match(messages, /afterStep/);
    assert.match(messages, /capturedAt/);
    assert.match(messages, /completedStepIds/);
    assert.match(messages, /measured, observed, inferred, or invented/);
  });

  test("requires settled state-family coverage around responsive boundaries", async () => {
    const artifact = await fixture("capture-scenarios.valid.json");
    const baseScenario = artifact.scenarios[0];
    artifact.scenarios = [990, 991, 992].map((width) => ({
      ...structuredClone(baseScenario),
      id: `navigation-${width}`,
      family: "navigation",
      viewport: {
        ...baseScenario.viewport,
        width,
      },
      states: [
        "menu-open-settled",
        "nested-disclosures-collapsed",
        "products-disclosure-expanded",
      ],
    }));
    artifact.responsiveStateCoverage = [
      {
        id: "navigation-991",
        route: "/products",
        width: 991,
        captureWidths: [990, 991, 992],
        stateFamilies: [
          {
            family: "navigation",
            states: [
              "menu-open-settled",
              "nested-disclosures-collapsed",
              "products-disclosure-expanded",
            ],
          },
        ],
        evidence: "Measured source layout transition",
      },
    ];

    assert.deepEqual(validateCaptureScenarios(artifact), {
      valid: true,
      errors: [],
    });

    const missingBoundaryScenario = structuredClone(artifact);
    missingBoundaryScenario.scenarios = missingBoundaryScenario.scenarios.filter(
      (scenario) => scenario.viewport.width !== 991,
    );
    const missingScenarioResult = validateCaptureScenarios(
      missingBoundaryScenario,
    );
    assert.equal(missingScenarioResult.valid, false);
    assert(
      missingScenarioResult.errors.some(
        (error) =>
          error.path ===
            "/responsiveStateCoverage/0/stateFamilies/0/states" &&
          error.message.includes("missing navigation scenario at 991px"),
      ),
    );

    const missingSettledState = structuredClone(artifact);
    missingSettledState.scenarios[0].states =
      missingSettledState.scenarios[0].states.filter(
        (state) => state !== "nested-disclosures-collapsed",
      );
    const missingStateResult = validateCaptureScenarios(missingSettledState);
    assert.equal(missingStateResult.valid, false);
    assert(
      missingStateResult.errors.some((error) =>
        error.message.includes("nested-disclosures-collapsed"),
      ),
    );

    const missingAdjacentWidth = structuredClone(artifact);
    missingAdjacentWidth.responsiveStateCoverage[0].captureWidths = [
      989,
      990,
      991,
    ];
    const missingWidthResult = validateCaptureScenarios(missingAdjacentWidth);
    assert.equal(missingWidthResult.valid, false);
    assert(
      missingWidthResult.errors.some(
        (error) =>
          error.path === "/responsiveStateCoverage/0/captureWidths" &&
          error.message.includes("breakpoint-adjacent width 992"),
      ),
    );
  });

  test("enforces canonical schema additional-property boundaries", async () => {
    const capture = await fixture("capture.valid.json");
    const scenarios = await fixture("capture-scenarios.valid.json");
    const siteInspection = await fixture("site-inspection.valid.json");

    capture.unexpected = true;
    scenarios.unexpected = true;
    siteInspection.unexpected = true;

    for (const result of [
      validateCapture(capture),
      validateCaptureScenarios(scenarios),
      validateSiteInspection(siteInspection),
    ]) {
      assert.equal(result.valid, false);
      assert(
        result.errors.some(
          (error) =>
            error.path === "$/unexpected" &&
            error.message === "additional property is not allowed",
        ),
      );
    }
  });
});

describe("deterministic helpers", () => {
  test("merges captures and replaces a resumed scenario capture by stable key", async () => {
    const capture = await fixture("capture.valid.json");
    const first = mergeSiteInspection(null, "example-store", [capture]);
    const replacement = structuredClone(capture);
    replacement.capturedAt = "2026-07-29T02:00:00.000Z";
    replacement.document.title = "Example products after retry";
    const second = mergeSiteInspection(first, "example-store", [replacement]);

    assert.equal(second.captures.length, 1);
    assert.equal(second.captures[0].capturedAt, replacement.capturedAt);
    assert.equal(second.captures[0].document.title, "Example products after retry");
  });

  test("CLI returns success for valid artifacts and failure for malformed artifacts", () => {
    const script = resolve(skillDirectory, "scripts/validate-artifact.mjs");
    const validPath = resolve(testDirectory, "fixtures/site-inspection.valid.json");
    const invalidPath = resolve(testDirectory, "fixtures/site-inspection.invalid.json");
    const valid = spawnSync(process.execPath, [script, validPath], { encoding: "utf8" });
    const invalid = spawnSync(process.execPath, [script, invalidPath], { encoding: "utf8" });

    assert.equal(valid.status, 0, valid.stderr);
    assert.match(valid.stdout, /site-inspection.*valid/);
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /invalid/);
  });
});

describe("bundled contracts", () => {
  test("schemas are parseable and expose the required evidence and scenario definitions", async () => {
    const siteSchema = JSON.parse(
      await readFile(resolve(repositoryRoot, "docs/research/schemas/site-inspection.schema.json"), "utf8")
    );
    const scenarioSchema = JSON.parse(
      await readFile(
        resolve(repositoryRoot, "docs/research/schemas/capture-scenarios.schema.json"),
        "utf8"
      )
    );

    assert.equal(siteSchema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.deepEqual(siteSchema.$defs.evidenceLevel.enum, [
      "measured",
      "observed",
      "inferred",
      "invented"
    ]);
    assert(scenarioSchema.$defs.scenario.required.includes("resume"));
    assert(scenarioSchema.$defs.scenario.required.includes("capturedAt"));
    assert.equal(
      scenarioSchema.properties.responsiveStateCoverage.items.$ref,
      "#/$defs/responsiveStateBoundary",
    );
  });

  test("browser scripts compile and the probe declares lossless flat traversal", async () => {
    const probe = await readFile(resolve(skillDirectory, "scripts/browser-probe.js"), "utf8");
    const telemetry = await readFile(
      resolve(skillDirectory, "scripts/browser-telemetry-init.js"),
      "utf8"
    );

    assert.doesNotThrow(() => new vm.Script(probe));
    assert.doesNotThrow(() => new vm.Script(telemetry));
    assert.match(probe, /flat-preorder-all-elements/);
    assert.doesNotMatch(probe, /maxDepth|maxChildren|slice\(0,/);
  });
});
