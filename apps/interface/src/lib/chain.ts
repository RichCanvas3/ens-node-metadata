import { mainnet, sepolia } from 'viem/chains'
import { addEnsContracts } from '@ensdomains/ensjs'

const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? '1', 10)
const baseChain = chainId === 11155111 ? sepolia : mainnet
export const chain = addEnsContracts(baseChain)
export { chainId }

const ENS_SUBGRAPH_MAINNET = 'https://api.alpha.ensnode.io/subgraph'
const ENS_SUBGRAPH_SEPOLIA = 'https://api.alpha-sepolia.ensnode.io/subgraph'

export const ensSubgraphUrl =
  process.env.NEXT_PUBLIC_ENS_SUBGRAPH_URL ??
  (chainId === 11155111 ? ENS_SUBGRAPH_SEPOLIA : ENS_SUBGRAPH_MAINNET)
