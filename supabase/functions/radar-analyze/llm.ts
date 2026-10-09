import { AnalysisResult, AnalysisJob } from './types.ts';

export interface LLMClient {
  analyze(job: AnalysisJob): Promise<AnalysisResult>;
}

export class MockLLMClient implements LLMClient {
  async analyze(job: AnalysisJob): Promise<AnalysisResult> {
    console.log(`[MockLLM] Analyzing item ${job.item_id}...`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      short_title: `Mock Title for ${job.category}`,
      summary: `This is a mock summary of the content: ${job.content.substring(0, 50)}...`,
      why_it_matters: `Mock explanation of why this ${job.category} is significant.`,
      topics: ['mock', job.category],
      evidence_level: 'abstract-based'
    };
  }
}

export class QwenLLMClient implements LLMClient {
  constructor(private config: { baseUrl: string; apiKey: string; model: string }) {}

  async analyze(job: AnalysisJob): Promise<AnalysisResult> {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { 
            role: 'system', 
            content: this.getSystemPrompt() 
          },
          { 
            role: 'user', 
            content: `Analyze the following ${job.category} content. 
            Original URL: ${job.url}
            Language: ${job.language}
            Content: ${job.content}` 
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API Error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = JSON.parse(data.choices[0].message.content);

    // Validation logic
    this.validateResult(content);
    
    return content;
  }

  private getSystemPrompt(): string {
    return `You are an AI research analyst. Extract key findings into a JSON object.
    Rules:
    - Plain language, no hype.
    - Constraints:
      - short_title: max 80 chars.
      - summary: max 180 chars.
      - why_it_matters: max 120 chars.
    - Fields:
      - short_title (string)
      - summary (string)
      - why_it_matters (string)
      - topics (string[])
      - evidence_level ('verified' | 'claim' | 'abstract-based')
    - If content is only an abstract, set evidence_level to 'abstract-based'.
    - Distinguish between author claims and verified facts.
    - Translate Chinese to English, but keep model names, dates, and source references original.
    - Return ONLY JSON.`;
  }

  private validateResult(res: any): void {
    if (!res.short_title || res.short_title.length > 80) {
      throw new Error('Invalid short_title length');
    }
    if (!res.summary || res.summary.length > 180) {
      throw new Error('Invalid summary length');
    }
    if (!res.why_it_matters || res.why_it_matters.length > 120) {
      throw new Error('Invalid why_it_matters length');
    }
    const validLevels = ['verified', 'claim', 'abstract-based'];
    if (!validLevels.includes(res.evidence_level)) {
      throw new Error('Invalid evidence_level');
    }
  }
}
