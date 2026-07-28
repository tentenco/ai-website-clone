#!/usr/bin/env node

/**
 * Generate platform skill/command files from every skill in .claude/skills.
 *
 * Usage:
 *   node scripts/sync-skills.mjs
 *   node scripts/sync-skills.mjs --check
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(root, ".claude", "skills");
const checkOnly = process.argv.includes("--check");
const unsupportedArgs = process.argv.slice(2).filter((arg) => arg !== "--check");

if (unsupportedArgs.length > 0) {
  console.error(`Unknown argument(s): ${unsupportedArgs.join(", ")}`);
  process.exit(2);
}

if (!existsSync(sourceRoot)) {
  console.error("Error: Source directory not found at .claude/skills");
  process.exit(1);
}

function normalizeText(value) {
  return value.replace(/\r\n/g, "\n");
}

function parseScalar(value) {
  const trimmed = value.trim();

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return JSON.parse(trimmed);
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }

  return trimmed;
}

function parseSkill(skillDirectory) {
  const sourcePath = join(sourceRoot, skillDirectory, "SKILL.md");
  const raw = normalizeText(readFileSync(sourcePath, "utf8"));
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!match) {
    throw new Error(
      `Could not parse frontmatter in .claude/skills/${skillDirectory}/SKILL.md`,
    );
  }

  const frontmatter = match[1];
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const descriptionMatch = frontmatter.match(/^description:\s*(.+)$/m);

  if (!nameMatch || !descriptionMatch) {
    throw new Error(
      `Skill ${skillDirectory} must define one-line name and description fields`,
    );
  }

  const name = parseScalar(nameMatch[1]);
  const description = parseScalar(descriptionMatch[1]);

  if (name !== skillDirectory) {
    throw new Error(
      `Skill directory ${skillDirectory} does not match frontmatter name ${name}`,
    );
  }

  return {
    name,
    description,
    raw,
    body: match[2],
  };
}

function listFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory).sort()) {
    if (entry === ".DS_Store") {
      continue;
    }

    const absolutePath = join(directory, entry);

    if (statSync(absolutePath).isDirectory()) {
      files.push(...listFiles(absolutePath));
    } else {
      files.push(absolutePath);
    }
  }

  return files;
}

function addExpected(expected, relativePath, content) {
  const buffer = Buffer.isBuffer(content)
    ? content
    : Buffer.from(normalizeText(content), "utf8");
  expected.set(relativePath, buffer);
}

function addSkillTree(expected, skillDirectory, targetRoot) {
  const sourceDirectory = join(sourceRoot, skillDirectory);

  for (const sourceFile of listFiles(sourceDirectory)) {
    const nestedPath = relative(sourceDirectory, sourceFile);
    addExpected(
      expected,
      join(targetRoot, skillDirectory, nestedPath),
      readFileSync(sourceFile),
    );
  }
}

function withoutArguments(text) {
  return text.replace(
    /\$ARGUMENTS/g,
    "the target or reference provided by the user",
  );
}

function commandBody(skill) {
  const header =
    `<!-- AUTO-GENERATED from .claude/skills/${skill.name}/SKILL.md. ` +
    "Do not edit directly. Run `node scripts/sync-skills.mjs` to regenerate. -->\n\n" +
    `Canonical bundled resources live under \`.claude/skills/${skill.name}/\`. ` +
    "Resolve relative scripts and references from that directory.\n\n";

  return header + withoutArguments(skill.body);
}

function tomlLiteral(text, skillName) {
  if (text.includes("'''")) {
    throw new Error(
      `Skill ${skillName} contains a triple single quote unsupported by the Gemini generator`,
    );
  }

  return `'''\n${text}\n'''`;
}

function generatedFilesForSkill(expected, skill) {
  const body = commandBody(skill);
  const description = JSON.stringify(skill.description);

  addSkillTree(expected, skill.name, ".codex/skills");
  addSkillTree(expected, skill.name, ".github/skills");

  addExpected(expected, `.cursor/commands/${skill.name}.md`, body);
  addExpected(expected, `.windsurf/workflows/${skill.name}.md`, body);
  addExpected(
    expected,
    `.gemini/commands/${skill.name}.toml`,
    `# AUTO-GENERATED from .claude/skills/${skill.name}/SKILL.md\n` +
      "# Run `node scripts/sync-skills.mjs` to regenerate.\n\n" +
      `description = ${description}\n` +
      `name = ${JSON.stringify(skill.name)}\n\n` +
      `prompt = ${tomlLiteral(body, skill.name)}\n`,
  );
  addExpected(
    expected,
    `.opencode/commands/${skill.name}.md`,
    `---\ndescription: ${description}\n---\n${body}`,
  );
  addExpected(
    expected,
    `.augment/commands/${skill.name}.md`,
    `---\ndescription: ${description}\nargument-hint: "<target>"\n---\n${body}`,
  );
  addExpected(
    expected,
    `.continue/commands/${skill.name}.md`,
    `---\nname: ${skill.name}\ndescription: ${description}\ninvokable: true\n---\n${body}`,
  );
  addExpected(
    expected,
    `.amazonq/cli-agents/${skill.name}.json`,
    `${JSON.stringify(
      {
        name: skill.name,
        description: skill.description,
        prompt: body,
        fileContext: [
          "AGENTS.md",
          "docs/CLONE_WORKFLOW_V2.md",
          "docs/research/**",
          `.claude/skills/${skill.name}/**`,
        ],
      },
      null,
      2,
    )}\n`,
  );
}

const skillDirectories = readdirSync(sourceRoot)
  .filter((entry) => {
    const absolutePath = join(sourceRoot, entry);
    return (
      statSync(absolutePath).isDirectory() &&
      existsSync(join(absolutePath, "SKILL.md"))
    );
  })
  .sort();

if (skillDirectories.length === 0) {
  console.error("Error: No source skills found under .claude/skills");
  process.exit(1);
}

const expected = new Map();

try {
  for (const skillDirectory of skillDirectories) {
    generatedFilesForSkill(expected, parseSkill(skillDirectory));
  }
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

if (checkOnly) {
  const drift = [];

  for (const [relativePath, content] of expected) {
    const absolutePath = join(root, relativePath);

    if (!existsSync(absolutePath)) {
      drift.push(`${relativePath}: missing`);
      continue;
    }

    if (!readFileSync(absolutePath).equals(content)) {
      drift.push(`${relativePath}: differs`);
    }
  }

  if (drift.length > 0) {
    console.error("Generated skills are out of sync:");
    drift.slice(0, 50).forEach((item) => console.error(`  - ${item}`));

    if (drift.length > 50) {
      console.error(`  - ...and ${drift.length - 50} more`);
    }

    process.exit(1);
  }

  console.log(
    `Skill sync check passed: ${skillDirectories.length} skills, ${expected.size} files.`,
  );
  process.exit(0);
}

console.log(`Syncing ${skillDirectories.length} skills to supported platforms...`);

for (const [relativePath, content] of expected) {
  const absolutePath = join(root, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}

for (const skillDirectory of skillDirectories) {
  console.log(`  ✓ ${skillDirectory}`);
}

console.log(`Done: wrote ${expected.size} generated files.`);
