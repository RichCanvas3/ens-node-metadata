import { NextResponse } from 'next/server'
import { DuneClient } from '@duneanalytics/client-sdk'

export async function GET() {
  const apiKey = process.env.DUNE_API_KEY
  if (!apiKey) {
    return NextResponse.json([])
  }
  try {
    const dune = new DuneClient(apiKey)
    const result = await dune.getLatestResult({ queryId: 6710900 })
    const rows = (result.result?.rows ?? []) as { class: string; counts: number }[]
    return NextResponse.json(rows)
  } catch {
    return NextResponse.json([])
  }
}
