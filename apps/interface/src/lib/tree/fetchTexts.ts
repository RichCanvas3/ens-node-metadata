import { createPublicClient, http } from "viem"
import { chain } from "@/lib/chain"

const client = createPublicClient({
  chain,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL!, {
    batch: {
      batchSize: 128,
    },
  }),
})

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

const RPC_BATCH_SIZE = 3
const RPC_BATCH_DELAY_MS = 80

export async function fetchTexts(ensName: string, keys: string[]) {
  const results: (string | undefined)[] = []
  for (let i = 0; i < keys.length; i += RPC_BATCH_SIZE) {
    const batch = keys.slice(i, i + RPC_BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map((key) => client.getEnsText({ name: ensName, key }))
    )
    results.push(
      ...batchResults.map((v) => (v === null ? undefined : v))
    )
    if (i + RPC_BATCH_SIZE < keys.length) await delay(RPC_BATCH_DELAY_MS)
  }
  return Object.fromEntries(keys.map((k, i) => [k, results[i]]))
}

/** Fetch the resolved ETH address for an ENS name via RPC (e.g. when subgraph has none). */
export async function fetchResolvedAddress(
  ensName: string,
): Promise<`0x${string}` | undefined> {
  try {
    const addr = await client.getEnsAddress({ name: ensName })
    if (addr && addr !== '0x0000000000000000000000000000000000000000') {
      return addr as `0x${string}`
    }
  } catch {
    // ignore
  }
  return undefined
}
