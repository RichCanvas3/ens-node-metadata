# @ens-node-metadata/schemas

A package for managing and publishing ENS node metadata schemas.

Explore existing schemas <https://ens-metadata-docs.vercel.app/schemas/agent>

## Ontology as single source of truth

Class definitions and schema shapes live in **ontology/ontology.ttl** (OWL + SHACL). The generators read Turtle only; do not edit `src/schemas/*.ts` by hand.

```bash
# Regenerate taxonomy, resolution table, and schema .ts files from ontology.ttl
pnpm generate

# Or run the steps separately:
pnpm ontology:generate   # → taxonomy.ttl, resolution-table.json (reads ontology.ttl + concepts-only.ttl)
pnpm schema:generate     # → src/schemas/*.ts (reads ontology.ttl SHACL shapes)
```

After changing `ontology/ontology.ttl` or `ontology/concepts-only.ttl`, run `pnpm generate`, then (if needed) `pnpm publish:schema -- --id <schemaId>` to publish a new version.

## Overview

- **Ontology** — `ontology/ontology.ttl` defines OWL classes (with `atl:schemaVersion`, `atl:schemaPath`, `atl:schemaId`) and SHACL NodeShapes (one per node class) with `sh:property`, `sh:path`, `atl:jsonKey`, `atl:recommended`, and optional `atl:patternProperty`. `ontology/concepts-only.ttl` holds SKOS concepts (Committee, Council, Workgroup) with `skos:broader`.
- **Generated** — `ontology:generate` produces `taxonomy/taxonomy.ttl` and `src/generated/resolution-table.json`. `schema:generate` produces `src/schemas/*.ts`.
- **ENSIP-denoted schemas** — managed in `src/globals` (e.g. ENSIP-5).

### Three-layer model

The ontology is structured in three layers:

1. **Ontology layer** — RDFS/OWL classes and atl: datatype properties with `rdfs:domain` and `rdfs:range`. Defines what the terms mean (e.g. `atl:name`, `atl:description`, `atl:agentWallet`). Semantic type is expressed by `rdf:type` (e.g. `rdf:type atl:AIAgentNode`).

2. **Shape layer** — SHACL NodeShapes with `sh:targetClass` and `sh:property` using **sh:path** to atl: properties. Constraints (e.g. `sh:minCount`, `sh:maxCount`, `sh:datatype`, `sh:pattern`, `sh:in`) live here. Each property constraint points at a real RDF property via `sh:path`.

3. **JSON serialization layer** — Custom atl: terms (`atl:jsonKey`, `atl:schemaTitle`, `atl:schemaPath`, `atl:format`, `atl:default`, etc.) define how to project to JSON Schema and ENS text records. These are not RDF semantics; they are the publishing profile. **RDF truth = rdf:type + property IRIs; JSON keys = atl:jsonKey.**

## Usage

```bash
# Publish a schema by ID
pnpm publish:schema --id org

# Publish and bump the version
pnpm publish:schema --id org --bump (patch|minor|major)

# Publish all common ENSIPs as a global collection
pnpm publish:globals
```

## Environment Variables

The following environment variables are required when publishing:

```sh
SCHEMA_PUBLISHER_PRIVATE_KEY=
PINATA_API_KEY=
PINATA_API_SECRET=
PINATA_JWT=
```

## Output Structure

Published artifacts are written to `packages/schemas/published/`:

```sh
published/
  _latest.json              # Map of schemaId → { version }
  _registry.json            # Full registry (ontology/taxonomy + schemas with schemaPath per version)
  {schemaId}/
    versions/{version}/
      schema.json           # Exported schema (only file needed for ontology loader)
    index.json              # Per-schema version list: schemaId, latest, published[{ version, schemaPath }]
```

## Behavior

- Publishing is **idempotent by version** — if `{schemaId}@{version}` has already been published, the command will refuse to overwrite it.
- No IPFS or checksum/signing; the app and resolution use ontology-based schema URLs only.

## Contributing

To suggest a new schema or changes to an existing one, open a pull request against the `develop` branch of the [repository](https://github.com/0xLighthouse/ens-node-metadata).

### Adding a new schema

1. In `ontology/ontology.ttl`: add an OWL class (e.g. `atl:MyNode a owl:Class ; ... atl:schemaId "my" ; atl:schemaVersion "1.0.0" ; atl:schemaPath "my-node.json" ; ...`) and a SHACL NodeShape with `sh:targetClass atl:MyNode`, `atl:schemaTitle`, `atl:schemaDescription`, `sh:property` (blank nodes with `atl:jsonKey`, `sh:datatype`, `sh:description`, `sh:minCount`, etc.), and optional `atl:recommended`, `atl:patternProperty`.
2. Run `pnpm generate` to produce `taxonomy/taxonomy.ttl`, `resolution-table.json`, and `src/schemas/my.ts`.
3. Add the new schema to the `SCHEMAS` array in `src/index.ts` (import and list it).

### Modifying an existing schema

Edit the class and its SHACL shape in `ontology/ontology.ttl` (properties via `sh:property` and `atl:jsonKey`, `atl:recommended`, `atl:schemaVersion`, etc.). Run `pnpm generate`. Use the following as a guide for choosing a version bump:

| Change type | Bump |
|---|---|
| Rename, remove, or change type of a field | `major` |
| New optional field | `minor` |
| Description or metadata only | `patch` |

Update the `version` field and the version segment of `$id` to match.

### Conventions

- File names should be lowercase, matching the schema's intended `title` (e.g. `delegate.ts` for `title: 'Delegate'`).
- Exported constant names follow the pattern `TITLE_SCHEMA` (e.g. `DELEGATE_SCHEMA`).
- New schemas should start at version `1.0.0`.
- Use `required` for fields that must be present (unusual), and `recommended` for fields that our UI will suggest the user should fill out.

### What to include in your PR

- A brief explanation of the use case the schema serves.
- A link to any relevant standard, EIP, or ENSIP referenced in the `source` field.
- For modifications, a clear description of what changed and why.

### What not to include

For community schemas that will live in this repo, do not run the publish scripts or commit anything under `published/`. Publishing is handled by maintainers after a PR is reviewed and merged.
