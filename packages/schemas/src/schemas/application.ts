// generated from ontology (SHACL) - do not edit
import type { Schema } from "../types";

export const APPLICATION_SCHEMA: Schema = {
  $id: 'https://schemas.agentictrust.io/application-node/v1.0.0/schema.json',
  source: 'https://schemas.agentictrust.io/',
  title: 'Application',
  version: '1.0.0',
  description: 'An application, service, or dApp within the organization.',
  type: 'object' as const,
  properties: {
    class: { type: 'string', description: 'High-level identifier of this node type', default: 'Application', enum: ['Application', 'Service', 'Website'] },
    name: { type: 'string', description: 'The name of the application' },
    description: { type: 'string', description: 'Description of the application\'s purpose and functionality' },
    url: { type: 'string', description: 'URL where the application is hosted or accessed', format: 'uri' },
    repository: { type: 'string', description: 'Source code repository URL' },
    version: { type: 'string', description: 'Current version of the application' },
    status: { type: 'string', description: 'Application status', enum: ['Active', 'Development', 'Deprecated'] },
  },
  required: ['class'],
  recommended: ['name', 'description', 'url', 'status']
};
