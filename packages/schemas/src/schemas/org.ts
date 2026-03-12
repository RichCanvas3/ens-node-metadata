// generated from ontology (SHACL) - do not edit
import type { Schema } from "../types";

export const ORGANIZATION_SCHEMA: Schema = {
  $id: 'https://schemas.agentictrust.io/org-node/v2.0.1/schema.json',
  source: 'https://schemas.agentictrust.io/',
  title: 'Organization',
  version: '2.0.1',
  description: 'A legal or organizational entity.',
  type: 'object' as const,
  properties: {
    'display-name': { type: 'string', description: 'Display name for this organization (distinct from ENS path)' },
    avatar: { type: 'string', description: 'A URL to an image used as an avatar or logo' },
    description: { type: 'string', description: 'A description of the name' },
    url: { type: 'string', description: 'URL of the organization', format: 'uri' },
  },
  recommended: ['display-name', 'avatar', 'description', 'url']
};
