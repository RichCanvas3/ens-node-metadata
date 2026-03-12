// generated from ontology (SHACL) - do not edit
import type { Schema } from "../types";

export const PERSON_SCHEMA: Schema = {
  $id: 'https://schemas.agentictrust.io/person-node/v1.0.0/schema.json',
  source: 'https://schemas.agentictrust.io/',
  title: 'Person',
  version: '1.0.0',
  description: 'A person.',
  type: 'object' as const,
  properties: {
    class: { type: 'string', description: 'High-level identifier of this node type', default: 'Person', enum: ['Person', 'Human', 'Signer', 'Officer', 'Employee', 'Secretary'] },
    'full-name': { type: 'string', description: 'Full legal or preferred name' },
    title: { type: 'string', description: 'Title within the organization, if any' },
  },
  required: ['class']
};
