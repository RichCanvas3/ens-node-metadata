import { createPublicClient, GetEnsNameReturnType, http } from 'viem'
import { chain } from '@/lib/chain'

const client = createPublicClient({
  chain,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL!, {
    batch: {
      batchSize: 1024,
    },
  }),
})

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Address = `0x${string}`

export type ENSDataByAddress = Map<Address, { name: GetEnsNameReturnType; avatar: string | null }>

const RPC_BATCH_SIZE = 5
const RPC_BATCH_DELAY_MS = 100

export async function mapNamesByAddress(addresses: Address[]): Promise<ENSDataByAddress> {
  const names: (GetEnsNameReturnType | null)[] = []
  for (let i = 0; i < addresses.length; i += RPC_BATCH_SIZE) {
    const batch = addresses.slice(i, i + RPC_BATCH_SIZE)
    const batchNames = await Promise.all(
      batch.map(async (address) => {
        try {
          return await client.getEnsName({ address })
        } catch {
          return null
        }
      })
    )
    names.push(...batchNames)
    if (i + RPC_BATCH_SIZE < addresses.length) await delay(RPC_BATCH_DELAY_MS)
  }

  const avatars: (string | null)[] = []
  for (let i = 0; i < names.length; i += RPC_BATCH_SIZE) {
    const batchNames = names.slice(i, i + RPC_BATCH_SIZE)
    const batchAvatars = await Promise.all(
      batchNames.map(async (name) => {
        if (!name) return null
        try {
          return await client.getEnsAvatar({ name })
        } catch (err) {
          console.log(`Failed to fetch avatar for ${name}:`, err)
          return null
        }
      })
    )
    avatars.push(...batchAvatars)
    if (i + RPC_BATCH_SIZE < names.length) await delay(RPC_BATCH_DELAY_MS)
  }

  return new Map(
    addresses.map((address, index) => [
      address,
      { name: names[index], avatar: avatars[index] },
    ])
  )
}
