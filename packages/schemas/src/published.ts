import registry from '../published/_registry.json'

export interface PublishedVersionEntry {
  schemaPath: string
  schema?: any
  /** @deprecated legacy IPFS; not written by publish scripts */
  cid?: string
  /** @deprecated legacy; not written by publish scripts */
  checksum?: string
  /** @deprecated legacy; not written by publish scripts */
  timestamp?: number
  meta?: any
}

export interface PublishedSchemaData {
  latest: string
  published: Record<string, PublishedVersionEntry>
}

export interface PublishedRegistry {
  schemas: Record<string, PublishedSchemaData>
}

/**
 * Legacy: loads registry (IPFS CIDs) and local schema files.
 * The interface app uses the ontology-based loader (load-schemas-node + /api/schemas) instead.
 * This export remains for CLI and other consumers that still use the registry.
 */
export async function getPublishedRegistry(): Promise<PublishedRegistry> {
  const enhancedRegistry: PublishedRegistry = {
    schemas: {},
  }

  for (const [schemaId, schemaData] of Object.entries(registry.schemas)) {
    enhancedRegistry.schemas[schemaId] = {
      latest: schemaData.latest,
      published: {},
    }

    for (const [version, versionData] of Object.entries(schemaData.published)) {
      try {
        const schemaModule = await import(
          `../published/${schemaId}/versions/${version}/schema.json`
        )
        enhancedRegistry.schemas[schemaId].published[version] = {
          ...versionData,
          schema: schemaModule.default || schemaModule,
        }
      } catch (error) {
        console.error(`Failed to load schema ${schemaId} v${version}:`, error)
        enhancedRegistry.schemas[schemaId].published[version] = {
          ...versionData,
        }
      }
    }
  }

  return enhancedRegistry
}
