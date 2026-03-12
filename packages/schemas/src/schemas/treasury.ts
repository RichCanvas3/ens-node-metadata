// generated from ontology (SHACL) - do not edit
import type { Schema } from "../types";

export const TREASURY_SCHEMA: Schema = {
  $id: 'https://schemas.agentictrust.io/treasury-node/v1.0.0/schema.json',
  source: 'https://schemas.agentictrust.io/',
  title: 'Treasury',
  version: '1.0.0',
  description: 'Funds and assets managed by a collective of individuals or entities.',
  type: 'object' as const,
  properties: {
    class: { type: 'string', description: 'High-level identifier of this node type', default: 'Treasury', enum: ['Treasury', 'Vault'] },
    name: { type: 'string', description: 'The name of the treasury' },
    description: { type: 'string', description: 'A description of the name' },
  },
  required: ['class'],
  recommended: ['name', 'description']
};
