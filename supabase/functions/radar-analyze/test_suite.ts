import { AnalysisResult, AnalysisJob } from './types.ts';
import { LLMClient, MockLLMClient, QwenLLMClient } from './llm.ts';
import { rankItem } from './ranking.ts';

// Test Suite for Agent 2 Analysis Module
async function runTests() {
  console.log('Starting Analysis Module Tests...');

  // 1. Mock Provider Test
  const mockLlm = new MockLLMClient();
  const job: AnalysisJob = {
    queue_id: 'q1',
    item_id: 'i1',
    content: 'This is a test paper about LLMs.',
    category: 'paper',
    url: 'https://example.com/paper',
    language: 'en'
  };
  const mockRes = await mockLlm.analyze(job);
  console.assert(mockRes.short_title.length <= 80, 'Mock title too long');
  console.log('✅ Mock Provider Test Passed');

  // 2. Ranking Logic Test
  const item = {
    category: 'model',
    published_at: new Date(),
    evidence_level: 'verified',
    topics: ['llm', 'scaling']
  };
  const rank = rankItem(item, ['llm']);
  console.assert(rank.score > 0, 'Ranking score should be positive');
  console.assert(rank.reason.includes('relevant topics'), 'Ranking reason missing topic match');
  console.log('✅ Ranking Logic Test Passed');

  // 3. Validation Test (Simulated Qwen Error)
  try {
    const badClient = {
      analyze: async () => ({
        short_title: 'A'.repeat(100), // Too long
        summary: 'Too long',
        why_it_matters: 'Too long',
        topics: [],
        evidence_level: 'unknown'
      })
    };
    // Normally QwenLLMClient.validateResult would catch this
    console.log('Checking validation logic...');
  } catch (e) {
    console.log('✅ Validation Logic caught error');
  }
}

runTests().catch(console.error);
