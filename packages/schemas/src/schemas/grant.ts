// generated from ontology (SHACL) - do not edit
import type { Schema } from "../types";

export const GRANT_SCHEMA: Schema = {
  $id: 'https://schemas.agentictrust.io/grant-node/v1.0.0/schema.json',
  source: 'https://schemas.agentictrust.io/',
  title: 'Grant',
  version: '1.0.0',
  description: 'A grant issued by an organization.',
  type: 'object' as const,
  properties: {
    class: { type: 'string', description: 'High-level identifier of this node type', default: 'Grant', enum: ['Grant', 'GrantProgram'] },
    name: { type: 'string', description: 'The name of the grant program' },
    description: { type: 'string', description: 'Description of the grant purpose and scope' },
    url: { type: 'string', description: 'URL of the grant program', format: 'uri' },
    status: { type: 'string', description: 'Grant status', enum: ['Active', 'Incomplete', 'Pending', 'Completed', 'Cancelled'] },
    budget: { type: 'string', description: 'Total budget expressed as WEI eg. 100 USDC = 100 * 10^6' },
    token: { type: 'string', description: 'Token expressed as ERC-20 token address eg. "0x0000000000000000000000000000000000000000"' },
  },
  required: ['class'],
  recommended: ['name', 'description', 'url', 'status', 'budget', 'token']
};
