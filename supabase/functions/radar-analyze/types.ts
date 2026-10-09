/**
 * AI Research Radar - Analysis Module
 * 
 * Responsibility: Turn raw collected items into short, grounded explanations.
 * Owner: Agent 2
 * 
 * Constraints:
 * - short_title: 80 chars
 * - summary: 180 chars
 * - why_it_matters: 120 chars
 * - No hype, plain language.
 * - Grounded in source; no invented links.
 * - Preserve original URLs.
 * - Translate Chinese to English, preserving entities.
 */

export interface AnalysisResult {
  short_title: string;
  summary: string;
  why_it_matters: string;
  topics: string[];
  evidence_level: 'verified' | 'claim' | 'abstract-based';
}

export interface AnalysisJob {
  queue_id: string;
  item_id: string;
  content: string;
  category: string;
  url: string;
  language: string;
}

export interface RankingScore {
  score: number;
  reason: string;
}
