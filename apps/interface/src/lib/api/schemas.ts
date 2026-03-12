import type { Schema } from '@/stores/schemas'

/**
 * Fetch all available schemas from the ontology-based API.
 * Schemas are keyed by versioned schema URI (https://schemas.agentictrust.io/...).
 */
export async function fetchSchemas(): Promise<Schema[]> {
  const res = await fetch('/api/schemas')
  if (!res.ok) throw new Error('Failed to fetch schemas')
  const { schemas: raw, globals } = await res.json()
  const ensip5Properties = globals?.schemas?.['ensip-5']?.properties ?? {}

  const schemas: Schema[] = raw.map(
    (entry: {
      id: string
      versionedSchemaUri: string
      displayClass: string
      schemaVersion: string
      isLatest?: boolean
      schema: Record<string, unknown>
    }) => ({
      ...entry.schema,
      properties: {
        ...ensip5Properties,
        ...(entry.schema.properties as Record<string, unknown>),
      },
      id: entry.versionedSchemaUri,
      title: entry.schema.title ?? entry.displayClass,
      class: entry.displayClass,
      version: entry.schemaVersion,
      isLatest: entry.isLatest ?? false,
    })
  )

  return schemas
}

/**
 * Fetch a specific schema by ID (versioned schema URI).
 */
export async function fetchSchemaById(id: string): Promise<Schema | null> {
  const schemas = await fetchSchemas()
  return schemas.find((s) => s.id === id) ?? null
}

/**
 * Fetch the latest schema by display class name (e.g. "Treasury", "Delegate").
 */
export async function fetchLatestSchemaByName(name: string): Promise<Schema | null> {
  const schemas = await fetchSchemas()
  return schemas.find((s) => s.class === name) ?? null
}
