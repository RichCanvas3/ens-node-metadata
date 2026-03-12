import { create } from 'zustand'
import { setRecords, createSubname, setResolver } from '@ensdomains/ensjs/wallet'
import type { ClientWithAccount } from '@ensdomains/ensjs/contracts'
import type { WalletClient } from 'viem'
import {
  getSchemaVersionForNode,
  getTypeUri,
  getVersionedSchemaUriForNode,
} from '@ens-node-metadata/schemas'
import type { TreeNode } from '@/lib/tree/types'
import { useTreeEditStore, type TreeMutation } from './tree-edits'
import { useTxnsStore } from './txns'
import { useTreeLoaderStore } from './tree-loader'

const asEnsWalletClient = (walletClient: WalletClient): ClientWithAccount =>
  walletClient as unknown as ClientWithAccount

const NON_TEXT_RECORD_KEYS = new Set([
  'inspectionData',
  'isSuggested',
  'isPendingCreation',
  'isComputed',
  'address',
  'owner',
  'children',
  'id',
  'name',
  'subdomainCount',
  'resolverId',
  'resolverAddress',
  'parentId',
  'ownerEnsName',
  'ownerEnsAvatar',
  'ttl',
  'texts',
])

export interface MutationJob {
  mutationId: string
  ensName: string
  resolverAddress: string
  status: 'pending' | 'signing' | 'submitted' | 'confirmed' | 'error'
  txHash?: `0x${string}`
  error?: string
}

interface MutationsState {
  jobs: MutationJob[]
  status: 'idle' | 'executing' | 'done' | 'error'
  submitMutations: (params: {
    mutationIds: string[]
    findNode: (name: string) => TreeNode | null
    walletClient: WalletClient
    publicClient: any
  }) => Promise<void>
  submitCreation: (params: {
    nodeName: string
    parentNode: TreeNode
    walletClient: WalletClient
    publicClient: any
  }) => Promise<`0x${string}`>
  reset: () => void
}

export const useMutationsStore = create<MutationsState>((set, get) => ({
  jobs: [],
  status: 'idle',

  submitMutations: async ({ mutationIds, findNode, walletClient, publicClient }) => {
    if (!walletClient.chain || !walletClient.account) {
      console.error('[mutations] wallet client missing chain or account')
      set({ status: 'error' })
      return
    }

    const allMutations = useTreeEditStore.getState().pendingMutations
    const selectedMutations: [string, TreeMutation][] = []
    for (const id of mutationIds) {
      const m = allMutations.get(id)
      if (m) selectedMutations.push([id, m])
    }

    if (selectedMutations.length === 0) return

    // Separate creations from edits
    const creations = selectedMutations.filter(([_, m]) => m.createNode)
    const edits = selectedMutations.filter(([_, m]) => !m.createNode)

    // Build initial jobs list
    const jobs: MutationJob[] = []

    // Creations are placeholder — log warning and skip
    for (const [nodeName, creation] of creations) {
      console.warn(
        `[mutations] createSubname not yet implemented — skipping creation for parent "${creation.parentName}"`,
      )
    }

    // Group edits by ensName (setRecords works per-name)
    const editsByName = new Map<
      string,
      { resolverAddress: string; texts: { key: string; value: string }[]; coins: { coin: string; value: string }[]; mutationIds: string[] }
    >()

    for (const [ensName, edit] of edits) {
      const node = findNode(ensName)
      const resolverAddress = node?.resolverAddress
      if (!resolverAddress) {
        console.warn(`[mutations] No resolver address found for "${ensName}" — skipping`)
        continue
      }

      // Ontology-only: write sem:type, sem:schema, sem:schemaVersion. Never write legacy class/schema.
      const texts: { key: string; value: string }[] = []
      if (edit.changes) {
        for (const [key, value] of Object.entries(edit.changes)) {
          if (NON_TEXT_RECORD_KEYS.has(key)) continue
          if (value === null || value === undefined) continue
          if (key === 'schema' || key === 'class') continue
          texts.push({ key, value: String(value) })
        }
      }

      // Add deletions as empty-string writes (ENS convention for removing text records)
      if (edit.deleted) {
        for (const key of edit.deleted) {
          if (NON_TEXT_RECORD_KEYS.has(key)) continue
          if (key === 'schema' || key === 'class') continue
          texts.push({ key, value: '' })
        }
      }

      // Ensure canonical ontology keys exist for typed nodes.
      const hasSemType = texts.some((t) => t.key === 'sem:type')
      const hasSemSchema = texts.some((t) => t.key === 'sem:schema')
      const hasSemVersion = texts.some((t) => t.key === 'sem:schemaVersion')

      const effectiveTypeUri =
        (edit.changes?.['sem:type'] != null ? String(edit.changes['sem:type']) : null) ??
        getTypeUri(node ?? undefined)

      if (effectiveTypeUri) {
        if (!hasSemType) texts.push({ key: 'sem:type', value: effectiveTypeUri })

        const mappedSchema = getVersionedSchemaUriForNode({ texts: { 'sem:type': effectiveTypeUri } })
        const mappedVersion = getSchemaVersionForNode({ texts: { 'sem:type': effectiveTypeUri } })
        if (!hasSemSchema && mappedSchema) texts.push({ key: 'sem:schema', value: mappedSchema })
        if (!hasSemVersion && mappedVersion) texts.push({ key: 'sem:schemaVersion', value: mappedVersion })
      }

      // Clear legacy keys if they exist on-chain (reduce confusion)
      if (node?.texts && Object.prototype.hasOwnProperty.call(node.texts, 'schema')) {
        texts.push({ key: 'schema', value: '' })
      }
      if (node?.texts && Object.prototype.hasOwnProperty.call(node.texts, 'class')) {
        texts.push({ key: 'class', value: '' })
      }

      // Extract address change as a coin record (batched into the same setRecords call)
      const coins: { coin: string; value: string }[] = []
      if (edit.changes?.address) {
        coins.push({ coin: 'ETH', value: edit.changes.address })
      }

      if (texts.length === 0 && coins.length === 0) continue

      const existing = editsByName.get(ensName)
      if (existing) {
        existing.texts.push(...texts)
        existing.coins.push(...coins)
        existing.mutationIds.push(ensName)
      } else {
        editsByName.set(ensName, { resolverAddress, texts, coins, mutationIds: [ensName] })
      }
    }

    // Build jobs from grouped edits
    for (const [ensName, { resolverAddress, mutationIds: mIds }] of editsByName) {
      for (const id of mIds) {
        jobs.push({
          mutationId: id,
          ensName,
          resolverAddress,
          status: 'pending',
        })
      }
    }

    set({ jobs, status: 'executing' })

    // Submit one setRecords call per ensName
    for (const [ensName, { resolverAddress, texts, coins, mutationIds: mIds }] of editsByName) {
      // Update jobs to signing
      set({
        jobs: get().jobs.map((j) =>
          mIds.includes(j.mutationId) ? { ...j, status: 'signing' as const } : j,
        ),
      })

      try {
        const txHash = await setRecords(asEnsWalletClient(walletClient), {
          name: ensName,
          texts,
          coins,
          resolverAddress: resolverAddress as `0x${string}`,
          account: walletClient.account,
        })

        // Track in txns store; discard mutation only after on-chain confirmation
        const { addTxn, watchTxn } = useTxnsStore.getState()
        addTxn({ hash: txHash, type: 'setRecords', label: ensName })
        watchTxn(txHash, publicClient).then(() => {
          const { txns } = useTxnsStore.getState()
          const txn = txns.find((t) => t.hash === txHash)
          if (txn?.status === 'confirmed') {
            const { discardPendingMutation } = useTreeEditStore.getState()
            for (const id of mIds) {
              discardPendingMutation(id)
            }
          }
        })

        // Update job to submitted (dialog tracks confirmed state via txns store)
        set({
          jobs: get().jobs.map((j) =>
            mIds.includes(j.mutationId)
              ? { ...j, status: 'submitted' as const, txHash }
              : j,
          ),
        })
      } catch (err: any) {
        const errorMessage = err?.message ?? 'Transaction failed'
        set({
          jobs: get().jobs.map((j) =>
            mIds.includes(j.mutationId)
              ? { ...j, status: 'error' as const, error: errorMessage }
              : j,
          ),
          status: 'error',
        })
        console.error(`[mutations] setRecords failed for "${ensName}":`, err)
      }
    }

    // Creations are handled via submitCreation (ApplyChangesDialog "Create Subname" button).

    // Set final status
    const finalJobs = get().jobs
    const hasErrors = finalJobs.some((j) => j.status === 'error')
    set({ status: hasErrors ? 'error' : 'done' })
  },

  submitCreation: async ({ nodeName, parentNode, walletClient, publicClient }) => {
    if (!walletClient.chain || !walletClient.account) {
      throw new Error('[mutations] wallet client missing chain or account')
    }

    const { addTxn, watchTxn } = useTxnsStore.getState()
    const { pendingMutations } = useTreeEditStore.getState()
    const mutation = pendingMutations.get(nodeName)
    if (!mutation?.createNode) throw new Error('[mutations] pending creation not found')

    // ensjs requires full name (e.g. "treasury.richcanvas.eth"); single-label "treasury" is treated as "tld" and throws
    const fullName = nodeName.includes('.')
      ? nodeName
      : `${nodeName}.${parentNode.name}`

    const resolverAddress = parentNode.resolverAddress
    if (!resolverAddress) throw new Error('[mutations] parent resolver address missing')

    // Build canonical text records from the queued creation changes.
    const texts: { key: string; value: string }[] = []
    const coins: { coin: string; value: string }[] = []

    const changes = mutation.changes ?? {}
    for (const [key, value] of Object.entries(changes)) {
      if (NON_TEXT_RECORD_KEYS.has(key)) continue
      if (value === null || value === undefined) continue
      if (key === 'schema' || key === 'class') continue
      if (key === 'address') {
        coins.push({ coin: 'ETH', value: String(value) })
        continue
      }
      texts.push({ key, value: String(value) })
    }

    // Ensure sem:type exists and derive sem:schema + sem:schemaVersion when missing.
    const semType = (changes as any)['sem:type'] ?? (mutation.texts as any)?.['sem:type']
    if (!semType) throw new Error('[mutations] missing sem:type for creation')

    const hasSemType = texts.some((t) => t.key === 'sem:type')
    const hasSemSchema = texts.some((t) => t.key === 'sem:schema')
    const hasSemVersion = texts.some((t) => t.key === 'sem:schemaVersion')

    if (!hasSemType) texts.push({ key: 'sem:type', value: String(semType) })
    const mappedSchema = getVersionedSchemaUriForNode({ texts: { 'sem:type': String(semType) } })
    const mappedVersion = getSchemaVersionForNode({ texts: { 'sem:type': String(semType) } })
    if (!hasSemSchema && mappedSchema) texts.push({ key: 'sem:schema', value: mappedSchema })
    if (!hasSemVersion && mappedVersion) texts.push({ key: 'sem:schemaVersion', value: mappedVersion })

    // 1) Create the subname (may already exist from a previous attempt).
    try {
      const hash = await createSubname(asEnsWalletClient(walletClient), {
        name: fullName,
        owner: walletClient.account.address as `0x${string}`,
        contract: parentNode.isWrapped ? 'nameWrapper' : 'registry',
        resolverAddress: resolverAddress as `0x${string}`,
        account: walletClient.account,
      })
      addTxn({ hash, type: 'createSubname', label: nodeName })
      void watchTxn(hash, publicClient)
      await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 })
    } catch (err) {
      // If the name already exists, continue and attempt to set records.
      console.warn('[mutations] createSubname failed (continuing to setRecords):', err)
    }

    // 2) Ensure resolver is set (needed for ENS app to show records), then set records.
    try {
      const currentResolver = await publicClient.getEnsResolver({ name: fullName })
      const desired = (resolverAddress as string).toLowerCase()
      const current = currentResolver?.address?.toLowerCase?.()
      if (!current || current !== desired) {
        const rHash = await setResolver(asEnsWalletClient(walletClient), {
          name: fullName,
          contract: parentNode.isWrapped ? 'nameWrapper' : 'registry',
          resolverAddress: resolverAddress as `0x${string}`,
          account: walletClient.account,
        })
        addTxn({ hash: rHash, type: 'setRecords', label: `${nodeName}:resolver` })
        void watchTxn(rHash, publicClient)
        await publicClient.waitForTransactionReceipt({ hash: rHash, confirmations: 1 })
      }
    } catch (err) {
      console.warn('[mutations] setResolver preflight failed (continuing):', err)
    }

    const setHash = await setRecords(asEnsWalletClient(walletClient), {
      name: fullName,
      texts,
      coins,
      resolverAddress: resolverAddress as `0x${string}`,
      account: walletClient.account,
    })
    addTxn({ hash: setHash, type: 'setRecords', label: nodeName })

    // When records tx confirms, drop pending creation and refresh tree.
    void watchTxn(setHash, publicClient).then(() => {
      const txn = useTxnsStore.getState().txns.find((t) => t.hash === setHash)
      if (txn?.status === 'confirmed') {
        useTreeEditStore.getState().discardPendingMutation(nodeName)
        const { refreshTree, treeRootName } = useTreeLoaderStore.getState()
        if (treeRootName) void refreshTree(treeRootName)
      }
    })

    return setHash
  },

  reset: () => set({ jobs: [], status: 'idle' }),
}))
