#!/usr/bin/env node
/**
 * Generates T-Box (OWL/RDFS ontology) and C-Box (SKOS taxonomy) from
 * mapping.json using stable + versioned schema URLs (no IPFS).
 * Run: pnpm --filter @ens-node-metadata/schemas ontology:generate
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packagesRoot = path.resolve(__dirname, '..')
const ontologyDir = path.join(packagesRoot, 'ontology')
const taxonomyDir = path.join(packagesRoot, 'taxonomy')
const mappingPath = path.join(ontologyDir, 'mapping.json')

const ONTOLOGY_BASE = 'https://ontology.agentictrust.io/'
const TAXONOMY_BASE = 'https://taxonomy.agentictrust.io/'
const SCHEMA_BASE = 'https://schemas.agentictrust.io/'

interface ClassMapping {
  typeLocalName: string
  conceptLocalName: string
  parentClass: string
  definition: string
  schemaPath: string
  schemaVersion: string
}

interface ConceptOnly {
  prefLabel: string
  definition: string
  broader?: string
}

interface Mapping {
  baseOntologyUri?: string
  baseTaxonomyUri?: string
  baseSchemaUri?: string
  classes: Record<string, ClassMapping>
  conceptsOnly?: Record<string, ConceptOnly>
}

function loadJson<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

function escapeTurtle(str: string): string {
  return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
}

/** Stable URL: https://schemas.agentictrust.io/agent-node.json */
function stableSchemaUrl(base: string, schemaPath: string): string {
  const b = base.endsWith('/') ? base : base + '/'
  return b + schemaPath
}

/** Versioned URL: https://schemas.agentictrust.io/agent-node/v1.0.0/schema.json */
function versionedSchemaUrl(base: string, schemaPath: string, version: string): string {
  const b = base.endsWith('/') ? base : base + '/'
  const family = schemaPath.replace(/\.json$/i, '')
  return `${b}${family}/v${version}/schema.json`
}

function main() {
  const mapping = loadJson<Mapping>(mappingPath)
  const ontologyBase = mapping.baseOntologyUri || ONTOLOGY_BASE
  const taxonomyBase = mapping.baseTaxonomyUri || TAXONOMY_BASE
  const schemaBase = mapping.baseSchemaUri || SCHEMA_BASE

  if (!fs.existsSync(ontologyDir)) fs.mkdirSync(ontologyDir, { recursive: true })
  if (!fs.existsSync(taxonomyDir)) fs.mkdirSync(taxonomyDir, { recursive: true })

  const atl = ontologyBase.endsWith('/') ? ontologyBase : ontologyBase + '/'
  const atc = taxonomyBase.endsWith('/') ? taxonomyBase : taxonomyBase + '/'

  // --- T-Box (ontology) ---
  const tboxLines: string[] = [
    `@prefix atl: <${atl}> .`,
    `@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .`,
    `@prefix owl: <http://www.w3.org/2002/07/owl#> .`,
    `@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .`,
    ``,
    `# Upper ontology (align with PROV-O / W3C where applicable)`,
    `atl:Node a owl:Class ;`,
    `  rdfs:label "ENS metadata node" .`,
    ``,
    `atl:ActorNode a owl:Class ;`,
    `  rdfs:subClassOf atl:Node ;`,
    `  rdfs:label "Actor node" .`,
    ``,
    `atl:EntityNode a owl:Class ;`,
    `  rdfs:subClassOf atl:Node ;`,
    `  rdfs:label "Entity node" .`,
    ``,
    `atl:OrganizationalNode a owl:Class ;`,
    `  rdfs:subClassOf atl:Node ;`,
    `  rdfs:label "Organizational node" .`,
    ``,
    `# Default schema: stable URL for this type (current compatible schema).`,
    `# ENS may optionally pin a versioned URL via sem:schema.`,
    `atl:defaultSchema a owl:ObjectProperty ;`,
    `  rdfs:domain atl:Node ;`,
    `  rdfs:label "default schema" .`,
    ``,
    `# Node classes (one per schema), with defaultSchema and subClassOf`,
  ]

  for (const [_schemaId, classMapping] of Object.entries(mapping.classes)) {
    const stableUri = stableSchemaUrl(schemaBase, classMapping.schemaPath)
    const typeUri = `atl:${classMapping.typeLocalName}`
    const parentUri = `atl:${classMapping.parentClass}`
    const lines: string[] = [
      `${typeUri} a owl:Class ;`,
      `  rdfs:subClassOf ${parentUri} ;`,
      `  atl:defaultSchema <${stableUri}> ;`,
      `  rdfs:label ${escapeTurtle(classMapping.conceptLocalName)} ;`,
      `  rdfs:comment ${escapeTurtle(classMapping.definition)} .`,
    ]
    tboxLines.push(...lines, '')
  }

  const tboxPath = path.join(ontologyDir, 'ontology.ttl')
  fs.writeFileSync(tboxPath, tboxLines.join('\n'), 'utf-8')
  console.log('Wrote T-Box:', tboxPath)

  // --- Resolution table (for runtime: type URI <-> display class, default + versioned schema) ---
  const byTypeUri: Record<
    string,
    {
      displayClass: string
      defaultSchemaUri: string
      versionedSchemaUri: string
      schemaVersion: string
      schemaId: string
    }
  > = {}
  const legacyClassToTypeUri: Record<string, string> = {}
  for (const [schemaId, classMapping] of Object.entries(mapping.classes)) {
    const typeUri = `${atl}${classMapping.typeLocalName}`
    const defaultSchemaUri = stableSchemaUrl(schemaBase, classMapping.schemaPath)
    const versionedSchemaUri = versionedSchemaUrl(
      schemaBase,
      classMapping.schemaPath,
      classMapping.schemaVersion
    )
    byTypeUri[typeUri] = {
      displayClass: classMapping.conceptLocalName,
      defaultSchemaUri,
      versionedSchemaUri,
      schemaVersion: classMapping.schemaVersion,
      schemaId,
    }
    legacyClassToTypeUri[classMapping.conceptLocalName] = typeUri
    if (classMapping.conceptLocalName === 'Org') {
      legacyClassToTypeUri['Organization'] = typeUri
      legacyClassToTypeUri['Organizational Unit'] = typeUri
    }
  }
  const resolutionTable = { byTypeUri, legacyClassToTypeUri }
  const generatedDir = path.join(packagesRoot, 'src', 'generated')
  if (!fs.existsSync(generatedDir)) fs.mkdirSync(generatedDir, { recursive: true })
  const resolutionTablePath = path.join(generatedDir, 'resolution-table.json')
  fs.writeFileSync(resolutionTablePath, JSON.stringify(resolutionTable, null, 2), 'utf-8')
  console.log('Wrote resolution table:', resolutionTablePath)

  // --- C-Box (SKOS taxonomy) ---
  const cboxLines: string[] = [
    `@prefix skos: <http://www.w3.org/2004/02/skos/core#> .`,
    `@prefix atc: <${atc}> .`,
    `@prefix atl: <${atl}> .`,
    ``,
    `atc:NodeTypes a skos:ConceptScheme ;`,
    `  skos:prefLabel "ENS node type concepts" .`,
    ``,
  ]

  for (const [_schemaId, classMapping] of Object.entries(mapping.classes)) {
    cboxLines.push(
      `atc:${classMapping.conceptLocalName} a skos:Concept ;`,
      `  skos:prefLabel ${escapeTurtle(classMapping.conceptLocalName)} ;`,
      `  skos:definition ${escapeTurtle(classMapping.definition)} ;`,
      `  skos:inScheme atc:NodeTypes ;`,
      `  skos:scopeNote "Maps to atl:${classMapping.typeLocalName}" .`,
      ``,
    )
  }

  // Broader concepts (for Committee, Council, Workgroup)
  cboxLines.push(
    `atc:GovernanceBody a skos:Concept ;`,
    `  skos:prefLabel "Governance body" ;`,
    `  skos:inScheme atc:NodeTypes .`,
    ``,
    `atc:OperationalUnit a skos:Concept ;`,
    `  skos:prefLabel "Operational unit" ;`,
    `  skos:inScheme atc:NodeTypes .`,
    ``,
  )

  for (const [_key, concept] of Object.entries(mapping.conceptsOnly || {})) {
    const safeName = concept.prefLabel.replace(/\s+/g, '')
    const lines = [
      `atc:${safeName} a skos:Concept ;`,
      `  skos:prefLabel ${escapeTurtle(concept.prefLabel)} ;`,
      `  skos:definition ${escapeTurtle(concept.definition)} ;`,
      `  skos:inScheme atc:NodeTypes ;`,
    ]
    if (concept.broader) {
      lines.push(`  skos:broader atc:${concept.broader} ;`)
    }
    lines.push(`  skos:scopeNote "Concept only; no schema in registry yet" .`, '')
    cboxLines.push(...lines)
  }

  const cboxPath = path.join(taxonomyDir, 'taxonomy.ttl')
  fs.writeFileSync(cboxPath, cboxLines.join('\n'), 'utf-8')
  console.log('Wrote C-Box:', cboxPath)
}

main()
