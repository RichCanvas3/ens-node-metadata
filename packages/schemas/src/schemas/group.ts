// generated from ontology (SHACL) - do not edit
import type { Schema } from "../types";

export const GROUP_SCHEMA: Schema = {
  $id: 'https://schemas.agentictrust.io/group-node/v0.1.4/schema.json',
  source: 'https://schemas.agentictrust.io/',
  title: 'Group',
  version: '0.1.4',
  description: 'This node describes a group of individuals or entities with a shared purpose or responsibility.',
  type: 'object' as const,
  properties: {
    class: { type: 'string', description: 'High-level identifier of this node type', default: 'Group', enum: ['Group', 'Committee', 'Council', 'Workgroup', 'Team'] },
    name: { type: 'string', description: 'The name of the group' },
    avatar: { type: 'string', description: 'A URL to an image used as an avatar or logo' },
    description: { type: 'string', description: 'A description of the name' },
    url: { type: 'string', description: 'URL of the group', format: 'uri' },
    lead: { type: 'string', description: 'ENS name or address of the group leader' },
    'lead-title': { type: 'string', description: 'Title or role of the group leader', enum: ['Lead Steward', 'Chair', 'Manager', 'Owner'] },
    'members-title': { type: 'string', description: 'Title or role of the group members', enum: ['Member', 'Steward', 'Contributor', 'Participant'] },
  },
  required: ['class'],
  recommended: ['name', 'lead', 'avatar', 'url', 'description']
};
