/**
 * Node-only loader: reads resolution table and published schema files.
 * Use from API routes or server; do not import in client bundles.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkgRoot = path.join(__dirname, '..')
const repoRoot = path.resolve(pkgRoot, '..', '..')

const resolutionTablePath = path.join(pkgRoot, 'src', 'generated', 'resolution-table.json')
const publishedRoot = path.join(pkgRoot, 'published')

export interface SchemaWithContent {
  id: string
  versionedSchemaUri: string
  defaultSchemaUri: string
  displayClass: string
  schemaVersion: string
  schemaId: string
  isLatest: boolean
  schema: Record<string, unknown>
}

export interface GlobalsBundle {
  schemas: Record<string, Record<string, unknown>>
}

export interface LoadSchemasResult {
  schemas: SchemaWithContent[]
  globals: GlobalsBundle
}

function loadJson<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

/**
 * Load all node schemas from the resolution table and published schema files.
 * Returns all published versions per schemaId so the UI can load nodes pinned to older sem:schema URIs.
 */
export function loadSchemasForUI(): LoadSchemasResult {
  const resolutionTable = loadJson<{
    byTypeUri: Record<
      string,
      {
        displayClass: string
        defaultSchemaUri: string
        versionedSchemaUri: string
        schemaVersion: string
        schemaId: string
      }
    >
  }>(resolutionTablePath)

  const schemas: SchemaWithContent[] = []

  // Map schemaId -> display metadata (one schemaId per type in our system)
  const schemaMetaById = new Map<
    string,
    { displayClass: string; defaultSchemaUri: string }
  >()
  for (const entry of Object.values(resolutionTable.byTypeUri)) {
    if (!schemaMetaById.has(entry.schemaId)) {
      schemaMetaById.set(entry.schemaId, {
        displayClass: entry.displayClass,
        defaultSchemaUri: entry.defaultSchemaUri,
      })
    }
  }

  for (const [schemaId, meta] of schemaMetaById.entries()) {
    const indexPath = path.join(publishedRoot, schemaId, 'index.json')
    if (!fs.existsSync(indexPath)) {
      console.warn(`[load-schemas-node] Missing schema index: ${indexPath}`)
      continue
    }

    const index = loadJson<{
      schemaId: string
      latest?: string
      published: Array<{ version: string; schemaPath: string }>
    }>(indexPath)

    const latest = index.latest
    for (const pub of index.published ?? []) {
      const schemaPath = path.join(repoRoot, pub.schemaPath)
      if (!fs.existsSync(schemaPath)) {
        console.warn(`[load-schemas-node] Missing schema file: ${schemaPath}`)
        continue
      }

      const schema = loadJson<Record<string, unknown>>(schemaPath)
      const versionedSchemaUri =
        typeof (schema as any)?.$id === 'string'
          ? String((schema as any).$id)
          : `${meta.defaultSchemaUri}/v${pub.version}/schema.json`

      schemas.push({
        id: versionedSchemaUri,
        versionedSchemaUri,
        defaultSchemaUri: meta.defaultSchemaUri,
        displayClass: meta.displayClass,
        schemaVersion: pub.version,
        schemaId,
        isLatest: latest != null ? pub.version === latest : false,
        schema,
      })
    }
  }

  // Load globals (ensip-5 etc.) from published/globals
  const globalsPath = path.join(publishedRoot, 'globals', 'versions', '1.0.0', 'schema.json')
  let globals: GlobalsBundle = { schemas: {} }
  if (fs.existsSync(globalsPath)) {
    const globalsFile = loadJson<{ schemas?: Record<string, Record<string, unknown>> }>(globalsPath)
    if (globalsFile.schemas) globals = { schemas: globalsFile.schemas }
  }

  return { schemas, globals }
}
