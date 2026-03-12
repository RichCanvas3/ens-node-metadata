// generated from ontology (SHACL) - do not edit
import type { Schema } from "../types";

export const PERSON_SCHEMA: Schema = {
  $id: 'https://schemas.agentictrust.io/person-node/v2.0.1/schema.json',
  source: 'https://schemas.agentictrust.io/',
  title: 'Person',
  version: '2.0.1',
  description: 'A person.',
  type: 'object' as const,
  properties: {
    'full-name': { type: 'string', description: 'Full legal or preferred name' },
    title: { type: 'string', description: 'Title within the organization, if any' },
  },
};
