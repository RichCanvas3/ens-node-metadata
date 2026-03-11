#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  arg,
  bumpVersion,
  loadSchema,
  readJson,
  writeJson,
  upsertPublished,
  toRepoPath,
} from "./helpers/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packagesRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packagesRoot, "..", "..");

const args = process.argv.slice(2);

const usage = () => {
  console.log(
    [
      "Usage: pnpm --filter @ens-node-metadata/schemas publish:schema -- --id <schemaId> [--bump patch|minor|major|x.y.z]",
      "Options:",
      "  --id, -i        Schema id (file base name in packages/schemas/src/schemas)",
      "  --bump, -b      Semver bump (patch|minor|major) or explicit version (optional)",
    ].join("\n"),
  );
};

const schemaIdRaw = arg(args, "--id", "-i");
if (!schemaIdRaw) {
  usage();
  process.exit(1);
}

const schemaId = schemaIdRaw.replace(/\.ts$/i, "");
const bumpRaw = arg(args, "--bump", "-b");
const bumpFlagUsed = args.includes("--bump") || args.includes("-b");
if (bumpFlagUsed && !bumpRaw) {
  console.error("Missing --bump value. Use patch|minor|major or x.y.z.");
  process.exit(1);
}

const schemaFile = path.join(packagesRoot, "src", "schemas", `${schemaId}.ts`);
if (!fs.existsSync(schemaFile)) {
  console.error(`Schema file not found: ${schemaFile}`);
  process.exit(1);
}

const fileText = fs.readFileSync(schemaFile, "utf8");
const versionMatch = fileText.match(/version:\s*['"](\d+\.\d+\.\d+)['"]/);
if (!versionMatch) {
  console.error(`Could not find version in ${schemaFile}`);
  process.exit(1);
}

const currentVersion = versionMatch[1];
const nextVersion = bumpRaw
  ? bumpVersion(currentVersion, bumpRaw)
  : currentVersion;

const publishedRoot = path.join(packagesRoot, "published");
const schemaRoot = path.join(publishedRoot, schemaId);
const registryPath = path.join(publishedRoot, "_registry.json");
const indexPath = path.join(schemaRoot, "index.json");

const registryCheck = readJson(registryPath, { schemas: {} as Record<string, any> });
const publishedByRegistry =
  registryCheck.schemas?.[schemaId]?.published?.[nextVersion];
const indexCheck = readJson(indexPath, { published: [] as Array<any> });
const publishedByIndex = Array.isArray(indexCheck.published)
  ? indexCheck.published.some((entry) => entry?.version === nextVersion)
  : false;
if (publishedByRegistry || publishedByIndex) {
  console.error(
    `Version ${nextVersion} for ${schemaId} is already published. Bump version or choose a new one.`,
  );
  process.exit(1);
}

if (bumpRaw && nextVersion !== currentVersion) {
  const updatedVersionLiteral = versionMatch[0].replace(
    currentVersion,
    nextVersion,
  );
  const updatedText = fileText.replace(versionMatch[0], updatedVersionLiteral);
  fs.writeFileSync(schemaFile, updatedText);
}

const schema = await loadSchema(schemaFile);
schema.version = nextVersion;

const versionRoot = path.join(schemaRoot, "versions", nextVersion);

fs.mkdirSync(versionRoot, { recursive: true });

const schemaJsonPath = path.join(versionRoot, "schema.json");
const schemaJson = JSON.stringify(schema, null, 2) + "\n";
fs.writeFileSync(schemaJsonPath, schemaJson, "utf8");

const schemaPath = toRepoPath(schemaJsonPath, repoRoot);
const publishedEntry = { schemaPath };

const latestPath = path.join(publishedRoot, "_latest.json");

const registry = readJson(registryPath, { schemas: {} as Record<string, any> });
registry.schemas[schemaId] ??= { latest: nextVersion, published: {} };
registry.schemas[schemaId].latest = nextVersion;
registry.schemas[schemaId].published[nextVersion] = publishedEntry;
writeJson(registryPath, registry);

const latest = readJson(latestPath, {} as Record<string, any>);
latest[schemaId] = { version: nextVersion };
writeJson(latestPath, latest);

const index = readJson(indexPath, {
  schemaId,
  latest: nextVersion,
  published: [] as Array<{ version: string; schemaPath: string }>,
});
index.schemaId = schemaId;
index.latest = nextVersion;
index.published = upsertPublished(index.published, {
  version: nextVersion,
  schemaPath,
});
writeJson(indexPath, index);

console.log(`Published ${schemaId}@${nextVersion}`);
