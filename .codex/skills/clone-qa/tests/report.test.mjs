import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { summarizeReport, validateReportSemantics } from "../scripts/lib/report.mjs";
import { validateFidelityReport } from "../scripts/validate-fidelity-report.mjs";

const fixture = (name) => fileURLToPath(new URL(`fixtures/${name}`, import.meta.url));
const readFixture = async (name) => JSON.parse(await readFile(fixture(name), "utf8"));

test("complete fidelity report validates and summarizes deterministically", async () => {
  const result = await validateFidelityReport(fixture("fidelity-valid.json"));

  assert.equal(result.valid, true, JSON.stringify(result.errors, null, 2));
  assert.deepEqual(summarizeReport(result.report), {
    target: "example",
    declaredStatus: "pass",
    derivedStatus: "pass",
    consistent: true,
    counts: { pass: 11, fail: 0, blocked: 0 },
    failedGateIds: [],
    blockedGateIds: [],
    openDiscrepancyIds: [],
    unapprovedDifferenceIds: [],
  });
});

test("structurally malformed reports fail with required-property errors", async () => {
  const result = await validateFidelityReport(
    fixture("fidelity-malformed-missing.json"),
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /missing required property/.test(error.message)));
});

test("declared pass cannot override a failed replay gate", async () => {
  const report = await readFixture("fidelity-valid.json");
  report.captureScenarios[0].status = "fail";

  const errors = validateReportSemantics(report);
  assert.ok(errors.some((error) => error.path === "$.final/status"));
  assert.ok(errors.some((error) => error.path === "$.final/counts/fail"));
});

test("implementation discrepancy cannot close by changing the specification", async () => {
  const report = await readFixture("fidelity-valid.json");
  report.discrepancies.push({
    id: "discrepancy-implementation",
    title: "Hero geometry misses frozen contract",
    classification: "implementation-defect",
    severity: "major",
    status: "resolved",
    description: "The clone hero is wider than the source.",
    affectedGateIds: ["static-hero"],
    resolution: {
      kind: "specification-correction",
      notes: "Incorrectly attempted to relax the frozen geometry.",
      authorityArtifact: "docs/research/example/components/hero.spec.md",
      evidenceIds: ["evidence-desktop"]
    },
    evidenceIds: ["evidence-desktop"]
  });

  const errors = validateReportSemantics(report);
  assert.ok(errors.some((error) => /requires an implementation-fix/.test(error.message)));
});

test("invented evidence errors preserve original array indexes", async () => {
  const report = await readFixture("fidelity-valid.json");
  report.evidence.push(
    {
      id: "evidence-observed-before-invented",
      level: "observed",
      claim: "Observed evidence preceding the invented entry.",
      artifact: "docs/design-references/example/observed.png",
      capturedAt: "2026-07-29T00:00:00.000Z",
      relatedGateIds: ["static-hero"],
    },
    {
      id: "evidence-invented-unapproved",
      level: "invented",
      claim: "An unapproved clone-mode invention.",
      artifact: "docs/design-references/example/invented.png",
      capturedAt: "2026-07-29T00:00:00.000Z",
      relatedGateIds: ["static-hero"],
    },
  );

  const errors = validateReportSemantics(report);
  assert.ok(
    errors.some(
      (error) =>
        error.path === `$.evidence/${report.evidence.length - 1}` &&
        /requires an approved deliberate difference/.test(error.message),
    ),
  );
});
