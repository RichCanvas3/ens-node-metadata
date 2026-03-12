#!/usr/bin/env node
/**
 * Reads ontology.ttl (and concepts-only.ttl), emits taxonomy.ttl and resolution-table.json.
 * ontology.ttl is the source of truth (not generated). Hierarchy is PROV-O-grounded.
 * Run: pnpm --filter @ens-node-metadata/schemas ontology:generate
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import N3 from 'n3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packagesRoot = path.resolve(__dirname, '..')
const ontologyDir = path.join(packagesRoot, 'ontology')
const taxonomyDir = path.join(packagesRoot, 'taxonomy')
const ontologyPath = path.join(ontologyDir, 'ontology.ttl')
const conceptsOnlyPath = path.join(ontologyDir, 'concepts-only.ttl')

const ONTOLOGY_BASE = 'https://ontology.agentictrust.io/'
const TAXONOMY_BASE = 'https://taxonomy.agentictrust.io/'
const SCHEMA_BASE = 'https://schemas.agentictrust.io/'

const ATL = ONTOLOGY_BASE.endsWith('/') ? ONTOLOGY_BASE : ONTOLOGY_BASE + '/'
const ATC = TAXONOMY_BASE.endsWith('/') ? TAXONOMY_BASE : TAXONOMY_BASE + '/'

const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label'
const RDFS_COMMENT = 'http://www.w3.org/2000/01/rdf-schema#comment'
const ATL_DEFAULT_SCHEMA = 'https://ontology.agentictrust.io/defaultSchema'
const ATL_SCHEMA_VERSION = 'https://ontology.agentictrust.io/schemaVersion'
const ATL_SCHEMA_PATH = 'https://ontology.agentictrust.io/schemaPath'
const ATL_SCHEMA_ID = 'https://ontology.agentictrust.io/schemaId'

function loadQuads(turtlePath: string): N3.Quad[] {
  const content = fs.readFileSync(turtlePath, 'utf-8')
  const parser = new N3.Parser()
  return parser.parse(content)
}

function getObjectValue(quads: N3.Quad[], subject: string, predicate: string): string | null {
  const quad = quads.find((q) => q.subject.value === subject && q.predicate.value === predicate)
  if (!quad) return null
  if (quad.object.termType === 'Literal') return (quad.object as N3.Literal).value
  if (quad.object.termType === 'NamedNode') return (quad.object as N3.NamedNode).value
  return null
}

function versionedSchemaUrl(schemaPath: string, version: string): string {
  const family = schemaPath.replace(/\.json$/i, '')
  return `${SCHEMA_BASE}${family}/v${version}/schema.json`
}

function escapeTurtle(str: string): string {
  return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
}

function main() {
  if (!fs.existsSync(ontologyPath)) {
    console.error('ontology.ttl not found at', ontologyPath)
    process.exit(1)
  }
  if (!fs.existsSync(taxonomyDir)) fs.mkdirSync(taxonomyDir, { recursive: true })

  let quads = loadQuads(ontologyPath)
  if (fs.existsSync(conceptsOnlyPath)) {
    quads = quads.concat(loadQuads(conceptsOnlyPath))
  }

  // Find all node classes (subjects that have atl:schemaId)
  const schemaIdQuads = quads.filter((q) => q.predicate.value === ATL_SCHEMA_ID)
  const nodeClasses: Array<{
    typeUri: string
    schemaId: string
    displayClass: string
    definition: string
    defaultSchemaUri: string
    schemaVersion: string
    schemaPath: string
  }> = []

  for (const q of schemaIdQuads) {
    const subject = q.subject.value
    if (!subject.startsWith(ATL) || !subject.endsWith('Node')) continue
    const schemaId = (q.object as N3.Literal).value
    const defaultSchema = getObjectValue(quads, subject, ATL_DEFAULT_SCHEMA)
    const schemaVersion = getObjectValue(quads, subject, ATL_SCHEMA_VERSION)
    const schemaPath = getObjectValue(quads, subject, ATL_SCHEMA_PATH)
    const label = getObjectValue(quads, subject, RDFS_LABEL)
    const comment = getObjectValue(quads, subject, RDFS_COMMENT)
    if (!defaultSchema || !schemaVersion || !schemaPath || !label) continue
    nodeClasses.push({
      typeUri: subject,
      schemaId,
      displayClass: label,
      definition: comment || '',
      defaultSchemaUri: defaultSchema,
      schemaVersion,
      schemaPath,
    })
  }

  // Resolution table
  const byTypeUri: Record<
    string,
    { displayClass: string; defaultSchemaUri: string; versionedSchemaUri: string; schemaVersion: string; schemaId: string }
  > = {}
  const displayClassToTypeUri: Record<string, string> = {}
  for (const c of nodeClasses) {
    byTypeUri[c.typeUri] = {
      displayClass: c.displayClass,
      defaultSchemaUri: c.defaultSchemaUri,
      versionedSchemaUri: versionedSchemaUrl(c.schemaPath, c.schemaVersion),
      schemaVersion: c.schemaVersion,
      schemaId: c.schemaId,
    }
    displayClassToTypeUri[c.displayClass] = c.typeUri
    if (c.displayClass === 'Org') displayClassToTypeUri['Organization'] = c.typeUri
  }
  const resolutionTable = { byTypeUri, displayClassToTypeUri }
  const generatedDir = path.join(packagesRoot, 'src', 'generated')
  if (!fs.existsSync(generatedDir)) fs.mkdirSync(generatedDir, { recursive: true })
  fs.writeFileSync(
    path.join(generatedDir, 'resolution-table.json'),
    JSON.stringify(resolutionTable, null, 2),
    'utf-8'
  )
  console.log('Wrote resolution table')

  // Taxonomy (C-Box)
  const cboxLines: string[] = [
    `@prefix skos: <http://www.w3.org/2004/02/skos/core#> .`,
    `@prefix atc: <${ATC}> .`,
    `@prefix atl: <${ONTOLOGY_BASE}> .`,
    ``,
    `atc:NodeTypes a skos:ConceptScheme ;`,
    `  skos:prefLabel "ENS node type concepts" .`,
    ``,
  ]
  for (const c of nodeClasses) {
    const conceptName = c.displayClass.replace(/\s+/g, '')
    const typeLocalName = c.typeUri.slice(ATL.length)
    cboxLines.push(
      `atc:${conceptName} a skos:Concept ;`,
      `  skos:prefLabel ${escapeTurtle(c.displayClass)} ;`,
      `  skos:definition ${escapeTurtle(c.definition)} ;`,
      `  skos:inScheme atc:NodeTypes ;`,
      `  skos:scopeNote "Maps to atl:${typeLocalName}" .`,
      ``
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
    ``
  )
  // Concepts from concepts-only.ttl (Committee, Council, Workgroup) - atc: namespace
  const SKOS_PREF_LABEL = 'http://www.w3.org/2004/02/skos/core#prefLabel'
  const SKOS_DEFINITION = 'http://www.w3.org/2004/02/skos/core#definition'
  const SKOS_IN_SCHEME = 'http://www.w3.org/2004/02/skos/core#inScheme'
  const SKOS_BROADER = 'http://www.w3.org/2004/02/skos/core#broader'
  const conceptQuads = quads.filter((q) => q.predicate.value === SKOS_PREF_LABEL)
  const atcSubjects = new Set<string>()
  for (const q of conceptQuads) {
    if (q.subject.value.startsWith(TAXONOMY_BASE) && q.subject.value !== `${TAXONOMY_BASE}NodeTypes`)
      atcSubjects.add(q.subject.value)
  }
  for (const subj of atcSubjects) {
    const prefLabel = getObjectValue(quads, subj, SKOS_PREF_LABEL)
    const definition = getObjectValue(quads, subj, SKOS_DEFINITION)
    const inScheme = quads.find((q) => q.subject.value === subj && q.predicate.value === SKOS_IN_SCHEME)
    const broader = quads.find((q) => q.subject.value === subj && q.predicate.value === SKOS_BROADER)
    if (!prefLabel || !inScheme) continue
    const localName = subj.slice(ATC.length)
    const lines = [
      `atc:${localName} a skos:Concept ;`,
      `  skos:prefLabel ${escapeTurtle(prefLabel)} ;`,
      `  skos:definition ${escapeTurtle(definition || '')} ;`,
      `  skos:inScheme atc:NodeTypes ;`,
    ]
    if (broader && broader.object.termType === 'NamedNode') {
      const broaderLocal = (broader.object as N3.NamedNode).value.slice(ATC.length)
      lines.push(`  skos:broader atc:${broaderLocal} ;`)
    }
    lines.push(`  skos:scopeNote "Concept only; no schema in registry yet" .`, '')
    cboxLines.push(...lines)
  }

  fs.writeFileSync(path.join(taxonomyDir, 'taxonomy.ttl'), cboxLines.join('\n'), 'utf-8')
  console.log('Wrote C-Box: taxonomy.ttl')
}

main()
