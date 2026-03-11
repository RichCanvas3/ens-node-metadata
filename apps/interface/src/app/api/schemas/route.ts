import { NextResponse } from 'next/server'
import { loadSchemasForUI } from '@ens-node-metadata/schemas/load-schemas-node'

/**
 * GET /api/schemas — returns ontology-based schema list and globals.
 * Replaces IPFS-based getPublishedRegistry; schemas are keyed by versioned schema URI.
 */
export async function GET() {
  try {
    const { schemas, globals } = loadSchemasForUI()
    return NextResponse.json({ schemas, globals })
  } catch (err) {
    console.error('[api/schemas]', err)
    return NextResponse.json(
      { error: 'Failed to load schemas' },
      { status: 500 }
    )
  }
}
