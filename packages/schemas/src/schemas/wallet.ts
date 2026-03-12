// generated from ontology (SHACL) - do not edit
import type { Schema } from "../types";

export const WALLET_SCHEMA: Schema = {
  $id: 'https://schemas.agentictrust.io/wallet-node/v1.0.0/schema.json',
  source: 'https://schemas.agentictrust.io/',
  title: 'Wallet',
  version: '1.0.0',
  description: 'A wallet for holding or managing assets.',
  type: 'object' as const,
  properties: {
    class: { type: 'string', description: 'High-level identifier of this node type', default: 'Wallet', enum: ['Wallet', 'Account'] },
    description: { type: 'string', description: 'Indicates the purpose of the wallet' },
  },
  required: ['class'],
  recommended: ['description']
};
