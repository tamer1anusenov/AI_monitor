
export class HFAdapter {
  constructor(private config: any) {}

  async fetch(checkpoint: string | null) {
    try {
      const response = await fetch('https://huggingface.co/api/papers');
      const data = await response.json();
      
      const items = data.papers.map((p: any) => ({
        external_id: `hf_${p.paperId}`,
        category: 'paper',
        title: p.title,
        content: p.summary,
        url: p.url,
        published_at: new Date().toISOString(),
        checksum: await this.generateChecksum(p.summary),
        checkpoint: p.paperId
      }));

      return items;
    } catch (e) {
      console.error('HF fetch failed:', e);
      return [];
    }
  }

  private async generateChecksum(text: string) {
    if (!text) return '';
    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
