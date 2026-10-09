import { AnalysisResult, AnalysisJob, RankingScore } from './types.ts';

export function rankItem(
  item: {
    category: string;
    published_at: Date;
    evidence_level: string;
    topics: string[];
  },
  targetTopics: string[] = []
): RankingScore {
  let score = 0;
  const reasons: string[] = [];

  // 1. Topic Relevance
  const matchedTopics = item.topics.filter(t => targetTopics.includes(t));
  if (matchedTopics.length > 0) {
    score += matchedTopics.length * 10;
    reasons.push(`${matchedTopics.length} relevant topics`);
  }

  // 2. Freshness (Decay over 30 days)
  const ageDays = (new Date().getTime() - item.published_at.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays < 7) {
    score += 20;
    reasons.push('very fresh (<7d)');
  } else if (ageDays < 30) {
    score += 10;
    reasons.push('fresh (<30d)');
  }

  // 3. Evidence Level
  const evidenceWeights = {
    'verified': 15,
    'claim': 5,
    'abstract-based': 2
  };
  const weight = evidenceWeights[item.evidence_level as keyof typeof evidenceWeights] || 0;
  score += weight;
  reasons.push(`evidence: ${item.evidence_level}`);

  // 4. Category Priority
  const categoryWeights = {
    'model': 5,
    'paper': 3,
    'tool': 3,
    'news': 1
  };
  score += categoryWeights[item.category as keyof typeof categoryWeights] || 0;

  return {
    score,
    reason: reasons.join(', ')
  };
}
