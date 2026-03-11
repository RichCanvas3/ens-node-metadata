/**
 * Node-only loader: reads resolution table and published schema files.
 * Use from API routes or server; do not import in client bundles.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkgRoot = path.join(__dirname, '..')

const resolutionTablePath = path.join(pkgRoot, 'src', 'generated', 'resolution-table.json')
const publishedRoot = path.join(pkgRoot, 'published')

export interface SchemaWithContent {
  id: string
  versionedSchemaUri: string
  defaultSchemaUri: string
  displayClass: string
  schemaVersion: string
  schemaId: string
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
 * Returns one entry per type (latest version per type from ontology config).
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

  for (const [_typeUri, entry] of Object.entries(resolutionTable.byTypeUri)) {
    const schemaPath = path.join(
      publishedRoot,
      entry.schemaId,
      'versions',
      entry.schemaVersion,
      'schema.json'
    )
    if (!fs.existsSync(schemaPath)) {
      console.warn(`[load-schemas-node] Missing schema file: ${schemaPath}`)
      continue
    }
    const schema = loadJson<Record<string, unknown>>(schemaPath)
    schemas.push({
      id: entry.versionedSchemaUri,
      versionedSchemaUri: entry.versionedSchemaUri,
      defaultSchemaUri: entry.defaultSchemaUri,
      displayClass: entry.displayClass,
      schemaVersion: entry.schemaVersion,
      schemaId: entry.schemaId,
      schema,
    })
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
