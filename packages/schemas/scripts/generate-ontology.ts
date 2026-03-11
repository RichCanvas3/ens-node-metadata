#!/usr/bin/env node
/**
 * Generates T-Box (OWL/RDFS ontology) and C-Box (SKOS taxonomy) from
 * mapping.json. Hierarchy is grounded in PROV-O (prov:Agent, prov:Entity,
 * prov:Person, prov:Organization, prov:SoftwareAgent, prov:Role).
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
const PROV = 'http://www.w3.org/ns/prov#'

interface ClassMapping {
  typeLocalName: string
  conceptLocalName: string
  parentClass?: string
  parentClassUri?: string
  definition: string
  schemaPath: string
  schemaVersion: string
  seeAlso?: string
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

function stableSchemaUrl(base: string, schemaPath: string): string {
  const b = base.endsWith('/') ? base : base + '/'
  return b + schemaPath
}

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

  // --- T-Box: PROV-O-grounded ontology ---
  const tboxLines: string[] = [
    `@prefix atl: <${atl}> .`,
    `@prefix prov: <${PROV}> .`,
    `@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .`,
    `@prefix owl: <http://www.w3.org/2002/07/owl#> .`,
    `@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .`,
    ``,
    `# ENS semantic node (root for this ontology)`,
    `atl:EnsNode a owl:Class ;`,
    `  rdfs:label "ENS semantic node" .`,
    ``,
    `# Default schema: stable URL for this type. ENS may pin a versioned URL via sem:schema.`,
    `atl:defaultSchema a owl:ObjectProperty ;`,
    `  rdfs:label "default schema" .`,
    ``,
    `# atl:OrganizationNode for org structure (Group, governance units, etc.)`,
    `atl:OrganizationNode a owl:Class ;`,
    `  rdfs:subClassOf prov:Organization ;`,
    `  rdfs:label "Organization node" .`,
    ``,
    `atl:GovernanceBody a owl:Class ;`,
    `  rdfs:subClassOf atl:OrganizationNode ;`,
    `  rdfs:label "Governance body" .`,
    ``,
    `atl:OperationalUnit a owl:Class ;`,
    `  rdfs:subClassOf atl:OrganizationNode ;`,
    `  rdfs:label "Operational unit" .`,
    ``,
    `# Node classes: subClassOf PROV-O or atl classes`,
  ]

  for (const [_schemaId, classMapping] of Object.entries(mapping.classes)) {
    const stableUri = stableSchemaUrl(schemaBase, classMapping.schemaPath)
    const typeUri = `atl:${classMapping.typeLocalName}`
    const parentRef = classMapping.parentClassUri
      ? `<${classMapping.parentClassUri}>`
      : `atl:${classMapping.parentClass}`
    const lines: string[] = [
      `${typeUri} a owl:Class ;`,
      `  rdfs:subClassOf ${parentRef} ;`,
      `  atl:defaultSchema <${stableUri}> ;`,
      `  rdfs:label ${escapeTurtle(classMapping.conceptLocalName)} ;`,
      `  rdfs:comment ${escapeTurtle(classMapping.definition)} .`,
    ]
    if (classMapping.seeAlso) {
      lines[0] = `${typeUri} a owl:Class ;`
      lines.splice(2, 0, `  rdfs:seeAlso <${classMapping.seeAlso}> ;`)
    }
    tboxLines.push(...lines, '')
  }

  const tboxPath = path.join(ontologyDir, 'ontology.ttl')
  fs.writeFileSync(tboxPath, tboxLines.join('\n'), 'utf-8')
  console.log('Wrote T-Box:', tboxPath)

  // --- Resolution table ---
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
    const entry = {
      displayClass: classMapping.conceptLocalName,
      defaultSchemaUri,
      versionedSchemaUri,
      schemaVersion: classMapping.schemaVersion,
      schemaId,
    }
    byTypeUri[typeUri] = entry
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
    const conceptName = classMapping.conceptLocalName.replace(/\s+/g, '')
    cboxLines.push(
      `atc:${conceptName} a skos:Concept ;`,
      `  skos:prefLabel ${escapeTurtle(classMapping.conceptLocalName)} ;`,
      `  skos:definition ${escapeTurtle(classMapping.definition)} ;`,
      `  skos:inScheme atc:NodeTypes ;`,
      `  skos:scopeNote "Maps to atl:${classMapping.typeLocalName}" .`,
      ``,
    )
  }

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
