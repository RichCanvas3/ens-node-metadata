// generated from ontology (SHACL) - do not edit
import type { Schema } from "../types";

export const WALLET_SCHEMA: Schema = {
  $id: 'https://schemas.agentictrust.io/wallet-node/v2.0.1/schema.json',
  source: 'https://schemas.agentictrust.io/',
  title: 'Wallet',
  version: '2.0.1',
  description: 'A wallet for holding or managing assets.',
  type: 'object' as const,
  properties: {
    description: { type: 'string', description: 'Indicates the purpose of the wallet' },
  },
  recommended: ['description']
};
