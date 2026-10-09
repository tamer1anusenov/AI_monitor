
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getEnabledSources, updateCheckpoint, upsertItem, enqueueAnalysis } from './_shared/db.ts'
import { ArxivAdapter } from './adapters/arxiv.ts'
import { HFAdapter } from './adapters/hf.ts'
import { GithubAdapter } from './adapters/github.ts'

const WORKER_SECRET = Deno.env.get('WORKER_SECRET')

serve(async (req) => {
  const auth = req.headers.get('Authorization')
  if (auth !== `Bearer ${WORKER_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const sources = await getEnabledSources()
  const results = []

  for (const source of sources) {
    try {
      let adapter
      switch (source.type) {
        case 'arxiv': adapter = new ArxivAdapter(source.config); break;
        case 'hf': adapter = new HFAdapter(source.config); break;
        case 'github': adapter = new GithubAdapter(source.config); break;
        default: 
          console.log(`No adapter for type ${source.type}`); 
          continue;
      }

      const items = await adapter.fetch(source.last_checkpoint)
      for (const item of items) {
        const saved = await upsertItem(item)
        if (saved && (item.checksum !== saved.checksum)) {
          await enqueueAnalysis(saved.id)
        }
      }
      
      if (items.length > 0) {
        await updateCheckpoint(source.id, items[items.length - 1].checkpoint)
      }
      results.push({ source: source.name, count: items.length })
    } catch (e) {
      console.error(`Error collecting from ${source.name}:`, e)
      results.push({ source: source.name, error: e.message })
    }
  }

  return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } })
})
