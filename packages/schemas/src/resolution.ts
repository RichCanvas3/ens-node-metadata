/**
 * Resolution: map ENS node text records (sem:type, sem:schema) to display class and schema URI.
 * Prefer sem:schema if present; else schema from sem:type.
 */

import resolutionTable from './generated/resolution-table.json' with { type: 'json' }

type ResolutionEntry = {
  displayClass: string
  defaultSchemaUri: string
  versionedSchemaUri: string
  schemaVersion: string
}

const { byTypeUri, displayClassToTypeUri } = resolutionTable as {
  byTypeUri: Record<string, ResolutionEntry>
  displayClassToTypeUri: Record<string, string>
}

const SEM_TYPE_KEYS = ['sem:type', 'sem\\:type'] as const
const SEM_SCHEMA_KEYS = ['sem:schema', 'sem\\:schema'] as const

export interface NodeLike {
  texts?: Record<string, string | null | undefined> | null
  class?: string | null
}

/**
 * Get the ontology type URI from the node if present (sem:type record).
 */
export function getTypeUri(node: NodeLike): string | undefined {
  if (!node?.texts) return undefined
  for (const key of SEM_TYPE_KEYS) {
    const v = node.texts[key]
    if (v && typeof v === 'string') return v
  }
  return undefined
}

/**
 * Get the schema URI from the node if present (sem:schema record).
 * Use this to detect an explicit version pin.
 */
export function getSchemaUriFromNode(node: NodeLike): string | undefined {
  if (!node?.texts) return undefined
  for (const key of SEM_SCHEMA_KEYS) {
    const v = node.texts[key]
    if (v && typeof v === 'string') return v
  }
  return undefined
}

/**
 * Get the display class label for the node (for badges, config lookup).
 * Resolves from sem:type only. No fallbacks.
 */
export function getDisplayClass(node: NodeLike): string | undefined {
  const typeUri = getTypeUri(node)
  if (!typeUri) return undefined
  const entry = byTypeUri[typeUri]
  return entry?.displayClass
}

/**
 * Get the ontology type URI for a display class (e.g. "Agent" -> type URI).
 * Used when writing ENS records to store sem:type alongside or instead of class.
 */
export function getTypeUriForDisplayClass(displayClass: string): string | undefined {
  return displayClassToTypeUri[displayClass]
}

/**
 * Get the default (stable) schema URI for a display class.
 * e.g. https://schemas.agentictrust.io/agent-node.json
 */
export function getDefaultSchemaUriForDisplayClass(displayClass: string): string | undefined {
  const typeUri = displayClassToTypeUri[displayClass]
  if (!typeUri) return undefined
  return byTypeUri[typeUri]?.defaultSchemaUri
}

/**
 * Get the versioned schema URI for a display class (for pinning).
 * e.g. https://schemas.agentictrust.io/agent-node/v1.0.0/schema.json
 */
export function getVersionedSchemaUriForDisplayClass(displayClass: string): string | undefined {
  const typeUri = displayClassToTypeUri[displayClass]
  if (!typeUri) return undefined
  return byTypeUri[typeUri]?.versionedSchemaUri
}

/**
 * Get the schema version string for a display class (e.g. "1.0.0").
 */
export function getSchemaVersionForDisplayClass(displayClass: string): string | undefined {
  const typeUri = displayClassToTypeUri[displayClass]
  if (!typeUri) return undefined
  return byTypeUri[typeUri]?.schemaVersion
}

/**
 * Get the JSON Schema URI for the node (for validation / schema fetch).
 * Prefer sem:schema if present; otherwise from sem:type (defaultSchema).
 */
export function getSchemaUriForNode(node: NodeLike): string | undefined {
  const explicitSchema = getSchemaUriFromNode(node)
  if (explicitSchema) return explicitSchema
  const typeUri = getTypeUri(node)
  if (!typeUri) return undefined
  const entry = byTypeUri[typeUri]
  return entry?.defaultSchemaUri
}

/**
 * Get the versioned schema URI for the node (for UI schema dropdown match).
 * sem:schema if present; else from sem:type. No fallbacks.
 */
export function getVersionedSchemaUriForNode(node: NodeLike): string | undefined {
  const explicitSchema = getSchemaUriFromNode(node)
  if (explicitSchema) return explicitSchema
  const typeUri = getTypeUri(node)
  if (!typeUri) return undefined
  const entry = byTypeUri[typeUri]
  return entry?.versionedSchemaUri
}
