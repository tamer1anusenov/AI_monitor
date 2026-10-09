
export class ArxivAdapter {
  constructor(private config: any) {}

  async fetch(checkpoint: string | null) {
    const categories = this.config.categories || ['cs.AI'];
    const query = `cat:${categories.join(' OR cat:')}`;
    const since = checkpoint || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const url = `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&sortBy=submittedDate&sortOrder=descending&max_results=50`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Arxiv API error: ${response.status}`);
      const xml = await response.text();
      const items = this.parseXml(xml);
      const filtered = items.filter(i => i.published_at > since);
      
      return filtered.map(i => ({
        external_id: i.id,
        category: 'paper',
        title: i.title,
        content: i.summary,
        url: i.url,
        published_at: i.published_at,
        checksum: await this.generateChecksum(i.summary),
        checkpoint: i.published_at
      }));
    } catch (e) {
      console.error('Arxiv fetch failed:', e);
      return [];
    }
  }

  private parseXml(xml: string) {
    const entries = [];
    const entryRegex = /<oai_dc:title>(.*?)<\/oai_dc:title>[\s\S]*?<dp:summary>(.*?)<\/dp:summary>[\s\S]*?<dc:identifier>(.*?)<\/dc:identifier>[\s\S]*?<dc:date>(.*?)<\/dc:date>/g;
    let match;
    while ((match = entryRegex.exec(xml)) !== null) {
      entries.push({
        title: match[1].trim(),
        summary: match[2].trim(),
        url: match[3].trim().replace('http://', 'https://'),
        id: match[3].trim().split('/').pop(),
        published_at: new Date(match[4].trim()).toISOString()
      });
    }
    return entries;
  }

  private async generateChecksum(text: string) {
    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
