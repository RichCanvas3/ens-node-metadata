// generated from ontology (SHACL) - do not edit
import type { Schema } from "../types";

export const COMPANY_SCHEMA: Schema = {
  $id: 'https://schemas.agentictrust.io/company-node/v1.0.0/schema.json',
  source: 'https://schemas.agentictrust.io/',
  title: 'Company',
  version: '1.0.0',
  description: 'A company; is-a Organization.',
  type: 'object' as const,
  properties: {
    class: { type: 'string', description: 'High-level identifier of this node type', default: 'Company', enum: ['Company'] },
    name: { type: 'string', description: 'The name of the company' },
    avatar: { type: 'string', description: 'A URL to an image used as an avatar or logo' },
    description: { type: 'string', description: 'A description of the company' },
    url: { type: 'string', description: 'URL of the company', format: 'uri' },
  },
  required: ['class'],
  recommended: ['name', 'avatar', 'description', 'url']
};
