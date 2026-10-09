import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AnalysisJob, AnalysisResult } from './types.ts';
import { LLMClient, MockLLMClient, QwenLLMClient } from './llm.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const LLM_BASE_URL = Deno.env.get('LLM_BASE_URL') || '';
const LLM_API_KEY = Deno.env.get('LLM_API_KEY') || '';
const LLM_MODEL = Deno.env.get('LLM_MODEL') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getLLMClient(): Promise<LLMClient> {
  if (!LLM_API_KEY || !LLM_BASE_URL) {
    console.warn('Missing LLM credentials, using MockLLMClient');
    return new MockLLMClient();
  }
  return new QwenLLMClient({
    baseUrl: LLM_BASE_URL,
    apiKey: LLM_API_KEY,
    model: LLM_MODEL,
  });
}

export async function processAnalysisQueue(limit = 10) {
  const llm = await getLLMClient();
  
  // 1. Atomic Job Claiming
  const { data: claimedJobs, error: claimError } = await supabase.rpc('claim_queue_items', {
    limit_count: limit,
    lease_duration: '10 minutes'
  });

  if (claimError) {
    console.error('Error claiming jobs:', claimError);
    return;
  }

  if (!claimedJobs || claimedJobs.length === 0) {
    console.log('No jobs to process');
    return;
  }

  for (const jobRow of claimedJobs) {
    const queueId = jobRow.id;
    const itemId = jobRow.item_id;

    try {
      // 2. Fetch Item Data
      const { data: item, error: itemError } = await supabase
        .from('radar_items')
        .select('content, category, url, checksum')
        .eq('id', itemId)
        .single();

      if (itemError || !item) throw new Error(`Item not found: ${itemId}`);

      // 3. Cache Check (Simplified: check if result already exists for this checksum)
      // In a real impl, we'd check a radar_analysis_cache table.
      
      // 4. Analysis with Retries
      const result = await analyzeWithRetry({
        queue_id: queueId,
        item_id: itemId,
        content: item.content,
        category: item.category,
        url: item.url,
        language: 'auto' // Simplified
      }, llm);

      // 5. Save result (Assumed table radar_analysis based on contract)
      const { error: saveError } = await supabase
        .from('radar_analysis')
        .upsert({
          item_id: itemId,
          short_title: result.short_title,
          summary: result.summary,
          why_it_matters: result.why_it_matters,
          topics: result.topics,
          evidence_level: result.evidence_level,
          updated_at: new Date().toISOString()
        });

      if (saveError) throw saveError;

      // 6. Complete Job
      await supabase.rpc('complete_queue_item', { queue_id: queueId });
      console.log(`Successfully processed item ${itemId}`);

    } catch (e) {
      console.error(`Failed to process job ${queueId}:`, e.message);
      await supabase.rpc('fail_queue_item', { 
        queue_id: queueId, 
        error_msg: e.message 
      });
    }
  }
}

async function analyzeWithRetry(job: AnalysisJob, llm: LLMClient, attempts = 3): Promise<AnalysisResult> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await llm.analyze(job);
    } catch (e) {
      if (i === attempts - 1) throw e;
      console.warn(`Analysis attempt ${i + 1} failed, retrying...`);
      await new Promise(res => setTimeout(res, 1000 * (i + 1)));
    }
  }
  throw new Error('Analysis failed after max retries');
}

// Entry point for Edge Function
Deno.serve(async (req) => {
  try {
    await processAnalysisQueue();
    return new Response(JSON.stringify({ status: 'success' }), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
});
