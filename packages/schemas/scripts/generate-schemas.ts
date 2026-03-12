#!/usr/bin/env node
/**
 * Generates src/schemas/*.ts from ontology.ttl (SHACL shapes).
 * Run: pnpm --filter @ens-node-metadata/schemas schema:generate
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import N3 from 'n3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packagesRoot = path.resolve(__dirname, '..')
const ontologyPath = path.join(packagesRoot, 'ontology', 'ontology.ttl')
const schemasDir = path.join(packagesRoot, 'src', 'schemas')

const GITHUB_URL = 'https://github.com/0xLighthouse/ens-node-metadata'
const SCHEMA_BASE = 'https://schemas.agentictrust.io/'
const ONTOLOGY_BASE = 'https://ontology.agentictrust.io/'

const SH_TARGET_CLASS = 'http://www.w3.org/ns/shacl#targetClass'
const SH_PROPERTY = 'http://www.w3.org/ns/shacl#property'
const SH_PATH = 'http://www.w3.org/ns/shacl#path'
const SH_DATATYPE = 'http://www.w3.org/ns/shacl#datatype'
const SH_DESCRIPTION = 'http://www.w3.org/ns/shacl#description'
const SH_MIN_COUNT = 'http://www.w3.org/ns/shacl#minCount'
const SH_IN = 'http://www.w3.org/ns/shacl#in'
const ATL_JSON_KEY = 'https://ontology.agentictrust.io/jsonKey'
const ATL_FORMAT = 'https://ontology.agentictrust.io/format'
const ATL_DEFAULT = 'https://ontology.agentictrust.io/default'
const ATL_SCHEMA_TITLE = 'https://ontology.agentictrust.io/schemaTitle'
const ATL_SCHEMA_DESCRIPTION = 'https://ontology.agentictrust.io/schemaDescription'
const ATL_SCHEMA_SOURCE = 'https://ontology.agentictrust.io/schemaSource'
const ATL_RECOMMENDED = 'https://ontology.agentictrust.io/recommended'
const ATL_PATTERN_PROPERTY = 'https://ontology.agentictrust.io/patternProperty'
const ATL_PATTERN = 'https://ontology.agentictrust.io/pattern'
const ATL_SCHEMA_VERSION = 'https://ontology.agentictrust.io/schemaVersion'
const ATL_SCHEMA_PATH = 'https://ontology.agentictrust.io/schemaPath'
const ATL_SCHEMA_ID = 'https://ontology.agentictrust.io/schemaId'
const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label'
const RDFS_COMMENT = 'http://www.w3.org/2000/01/rdf-schema#comment'
const RDF_FIRST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first'
const RDF_REST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest'
const RDF_NIL = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil'
const XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string'
const XSD_BOOLEAN = 'http://www.w3.org/2001/XMLSchema#boolean'
const XSD_ANY_URI = 'http://www.w3.org/2001/XMLSchema#anyURI'

interface PropertySpec {
  type: string
  description: string
  format?: string
  default?: string
  examples?: string[]
  enum?: string[]
}

interface ClassMapping {
  typeLocalName: string
  conceptLocalName: string
  definition: string
  schemaPath: string
  schemaVersion: string
  schemaTitle?: string
  schemaDescription?: string
  schemaSource?: string
  properties: Record<string, PropertySpec>
  required: string[]
  recommended: string[]
  patternProperties?: Record<string, { type: string; description: string }>
}

function loadQuads(turtlePath: string): N3.Quad[] {
  const content = fs.readFileSync(turtlePath, 'utf-8')
  return new N3.Parser().parse(content)
}

function getObjectValue(quads: N3.Quad[], subject: string, predicate: string): string | null {
  const q = quads.find((q) => q.subject.value === subject && q.predicate.value === predicate)
  if (!q) return null
  if (q.object.termType === 'Literal') return (q.object as N3.Literal).value
  if (q.object.termType === 'NamedNode') return (q.object as N3.NamedNode).value
  return null
}

function getListValues(quads: N3.Quad[], listNode: string): string[] {
  const out: string[] = []
  let current: string | null = listNode
  const seen = new Set<string>()
  while (current && !seen.has(current)) {
    seen.add(current)
    if (current === RDF_NIL) break
    const firstQ = quads.find((q) => q.subject.value === current && q.predicate.value === RDF_FIRST)
    if (firstQ && firstQ.object.termType === 'Literal') out.push((firstQ.object as N3.Literal).value)
    const restQ = quads.find((q) => q.subject.value === current && q.predicate.value === RDF_REST)
    current = restQ && restQ.object.termType === 'NamedNode' ? (restQ.object as N3.NamedNode).value : null
    if (restQ && restQ.object.termType === 'BlankNode') current = (restQ.object as N3.BlankNode).value
  }
  return out
}

function xsdToJsonType(datatypeUri: string): string {
  if (datatypeUri === XSD_BOOLEAN) return 'boolean'
  if (datatypeUri === XSD_ANY_URI) return 'string'
  return 'string'
}

function extractClassMappingFromShape(quads: N3.Quad[], shapeSubject: string, targetClassUri: string): ClassMapping | null {
  const schemaId = getObjectValue(quads, targetClassUri, ATL_SCHEMA_ID)
  const schemaVersion = getObjectValue(quads, targetClassUri, ATL_SCHEMA_VERSION)
  const schemaPath = getObjectValue(quads, targetClassUri, ATL_SCHEMA_PATH)
  const conceptLocalName = getObjectValue(quads, targetClassUri, RDFS_LABEL)
  const definition = getObjectValue(quads, targetClassUri, RDFS_COMMENT)
  if (!schemaId || !schemaVersion || !schemaPath || !conceptLocalName) return null

  const typeLocalName = targetClassUri.startsWith(ONTOLOGY_BASE) ? targetClassUri.slice(ONTOLOGY_BASE.length) : targetClassUri
  const schemaTitle = getObjectValue(quads, shapeSubject, ATL_SCHEMA_TITLE)
  const schemaDescription = getObjectValue(quads, shapeSubject, ATL_SCHEMA_DESCRIPTION)
  const schemaSource = getObjectValue(quads, shapeSubject, ATL_SCHEMA_SOURCE)

  const recommended: string[] = []
  for (const q of quads) {
    if (q.subject.value === shapeSubject && q.predicate.value === ATL_RECOMMENDED && q.object.termType === 'Literal')
      recommended.push((q.object as N3.Literal).value)
  }

  const properties: Record<string, PropertySpec> = {}
  const required: string[] = []
  const propertyQuads = quads.filter((q) => q.subject.value === shapeSubject && q.predicate.value === SH_PROPERTY)
  for (const q of propertyQuads) {
    if (q.object.termType !== 'BlankNode') continue
    const bn = (q.object as N3.BlankNode).value
    const pathUri = getObjectValue(quads, bn, SH_PATH)
    const jsonKey =
      getObjectValue(quads, bn, ATL_JSON_KEY) ?? (pathUri ? pathUri.replace(/^.*[/#]/, '') : null)
    if (!jsonKey) continue
    const desc = getObjectValue(quads, bn, SH_DESCRIPTION)
    let datatypeUri = XSD_STRING
    const dtQ = quads.find((x) => x.subject.value === bn && x.predicate.value === SH_DATATYPE)
    if (dtQ && dtQ.object.termType === 'NamedNode') datatypeUri = (dtQ.object as N3.NamedNode).value
    const minCount = getObjectValue(quads, bn, SH_MIN_COUNT)
    const format = getObjectValue(quads, bn, ATL_FORMAT)
    const defaultVal = getObjectValue(quads, bn, ATL_DEFAULT)
    const inQuad = quads.find((x) => x.subject.value === bn && x.predicate.value === SH_IN)
    let enumVal: string[] | undefined
    if (inQuad && inQuad.object.termType === 'BlankNode') enumVal = getListValues(quads, (inQuad.object as N3.BlankNode).value)
    if (enumVal && enumVal.length === 0) enumVal = undefined

    properties[jsonKey] = {
      type: xsdToJsonType(datatypeUri),
      description: desc ?? '',
      ...(format && { format }),
      ...(defaultVal && { default: defaultVal }),
      ...(enumVal && enumVal.length && { enum: enumVal }),
    }
    if (minCount === '1') required.push(jsonKey)
  }
  if (required.length === 0) required.push('class')

  const patternProperties: Record<string, { type: string; description: string }> = {}
  const ppQuads = quads.filter((q) => q.subject.value === shapeSubject && q.predicate.value === ATL_PATTERN_PROPERTY)
  for (const q of ppQuads) {
    if (q.object.termType !== 'BlankNode') continue
    const bn = (q.object as N3.BlankNode).value
    const pattern = getObjectValue(quads, bn, ATL_PATTERN)
    const desc = getObjectValue(quads, bn, SH_DESCRIPTION)
    if (pattern) patternProperties[pattern] = { type: 'string', description: desc || '' }
  }

  return {
    typeLocalName,
    conceptLocalName,
    definition: definition || '',
    schemaPath,
    schemaVersion,
    schemaTitle: schemaTitle || undefined,
    schemaDescription: schemaDescription || undefined,
    schemaSource: schemaSource || undefined,
    properties,
    required,
    recommended,
    patternProperties: Object.keys(patternProperties).length ? patternProperties : undefined,
  }
}

function quoteKey(key: string): string {
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) return key
  return `'${key.replace(/'/g, "\\'")}'`
}

function quoteStr(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`
}

function serializeAttribute(spec: PropertySpec): string {
  const parts: string[] = [
    `type: ${quoteStr(spec.type)}`,
    `description: ${quoteStr(spec.description)}`,
  ]
  if (spec.format != null) parts.push(`format: ${quoteStr(spec.format)}`)
  if (spec.default != null) parts.push(`default: ${quoteStr(spec.default)}`)
  if (spec.examples != null)
    parts.push(`examples: [${spec.examples.map((e) => quoteStr(e)).join(', ')}]`)
  if (spec.enum != null)
    parts.push(`enum: [${spec.enum.map((e) => quoteStr(e)).join(', ')}]`)
  return `{ ${parts.join(', ')} }`
}

function versionedSchemaUrl(base: string, schemaPath: string, version: string): string {
  const b = base.endsWith('/') ? base : base + '/'
  const family = schemaPath.replace(/\.json$/i, '')
  return `${b}${family}/v${version}/schema.json`
}

function generateSchemaFile(schemaId: string, classMapping: ClassMapping): string {
  const schemaBase = SCHEMA_BASE
  const versionedUri = versionedSchemaUrl(schemaBase, classMapping.schemaPath, classMapping.schemaVersion)
  const title = classMapping.schemaTitle ?? classMapping.conceptLocalName
  const description = classMapping.schemaDescription ?? classMapping.definition
  const source = classMapping.schemaSource ?? schemaBase ?? GITHUB_URL
  const required = classMapping.required.length ? classMapping.required : ['class']
  const constNameMap: Record<string, string> = {
    agent: 'AGENT_SCHEMA',
    application: 'APPLICATION_SCHEMA',
    company: 'COMPANY_SCHEMA',
    contract: 'CONTRACT_SCHEMA',
    delegate: 'DELEGATE_SCHEMA',
    grant: 'GRANT_SCHEMA',
    group: 'GROUP_SCHEMA',
    org: 'ORGANIZATION_SCHEMA',
    person: 'PERSON_SCHEMA',
    treasury: 'TREASURY_SCHEMA',
    wallet: 'WALLET_SCHEMA',
  }
  const exportName = constNameMap[schemaId] ?? schemaId + '_SCHEMA'

  const lines: string[] = [
    '// generated from ontology (SHACL) - do not edit',
    'import type { Schema } from "../types";',
    '',
    `export const ${exportName}: Schema = {`,
    `  $id: ${quoteStr(versionedUri)},`,
    `  source: ${quoteStr(source)},`,
    `  title: ${quoteStr(title)},`,
    `  version: ${quoteStr(classMapping.schemaVersion)},`,
    `  description: ${quoteStr(description)},`,
    `  type: 'object' as const,`,
    '  properties: {',
  ]

  for (const [key, spec] of Object.entries(classMapping.properties)) {
    lines.push(`    ${quoteKey(key)}: ${serializeAttribute(spec)},`)
  }
  lines.push('  },')
  if (classMapping.patternProperties && Object.keys(classMapping.patternProperties).length > 0) {
    lines.push('  patternProperties: {')
    for (const [pattern, spec] of Object.entries(classMapping.patternProperties)) {
      lines.push(`    ${quoteKey(pattern)}: { type: ${quoteStr(spec.type)}, description: ${quoteStr(spec.description)} },`)
    }
    lines.push('  },')
  }
  lines.push(`  required: [${required.map((r) => quoteStr(r)).join(', ')}]`)
  if (classMapping.recommended && classMapping.recommended.length > 0) {
    lines[lines.length - 1] += ','
    lines.push(`  recommended: [${classMapping.recommended.map((r) => quoteStr(r)).join(', ')}]`)
  }
  lines.push('};')

  return lines.join('\n')
}

function main() {
  if (!fs.existsSync(ontologyPath)) {
    console.error('ontology.ttl not found at', ontologyPath)
    process.exit(1)
  }
  if (!fs.existsSync(schemasDir)) fs.mkdirSync(schemasDir, { recursive: true })

  const quads = loadQuads(ontologyPath)
  const targetClassQuads = quads.filter((q) => q.predicate.value === SH_TARGET_CLASS)
  const shapeToClass = new Map<string, string>()
  for (const q of targetClassQuads) {
    if (q.object.termType === 'NamedNode' && q.subject.value.startsWith(ONTOLOGY_BASE))
      shapeToClass.set(q.subject.value, (q.object as N3.NamedNode).value)
  }

  for (const [shapeSubject, targetClassUri] of shapeToClass) {
    if (!targetClassUri.startsWith(ONTOLOGY_BASE) || !targetClassUri.endsWith('Node')) continue
    const classMapping = extractClassMappingFromShape(quads, shapeSubject, targetClassUri)
    if (!classMapping || Object.keys(classMapping.properties).length === 0) continue
    const schemaId = getObjectValue(quads, targetClassUri, ATL_SCHEMA_ID)
    if (!schemaId) continue
    const content = generateSchemaFile(schemaId, classMapping)
    const outPath = path.join(schemasDir, `${schemaId}.ts`)
    fs.writeFileSync(outPath, content + '\n', 'utf-8')
    console.log('Wrote', outPath)
  }
  console.log('Done.')
}

main()
