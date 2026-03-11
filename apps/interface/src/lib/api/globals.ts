import type { Schema as BaseSchema } from '@ens-node-metadata/schemas/types'

/**
 * Fetch global sub-schemas (e.g. ENSIP-5) from the ontology-based schemas API.
 */
export async function fetchGlobals(): Promise<Record<string, BaseSchema>> {
  const res = await fetch('/api/schemas')
  if (!res.ok) return {}
  const { globals } = await res.json()
  return globals?.schemas ?? {}
}
