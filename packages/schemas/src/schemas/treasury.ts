// generated from ontology (SHACL) - do not edit
import type { Schema } from "../types";

export const TREASURY_SCHEMA: Schema = {
  $id: 'https://schemas.agentictrust.io/treasury-node/v2.0.1/schema.json',
  source: 'https://schemas.agentictrust.io/',
  title: 'Treasury',
  version: '2.0.1',
  description: 'Funds and assets managed by a collective of individuals or entities.',
  type: 'object' as const,
  properties: {
    'display-name': { type: 'string', description: 'Display name for the treasury (distinct from ENS path)' },
    description: { type: 'string', description: 'A description of the name' },
  },
  recommended: ['display-name', 'description']
};
