
export class GithubAdapter {
  constructor(private config: any) {}

  async fetch(checkpoint: string | null) {
    const results = [];
    const token = Deno.env.get('GITHUB_TOKEN');
    const headers = token ? { 'Authorization': `token ${token}` } : {};

    for (const org of (this.config.orgs || [])) {
      try {
        const res = await fetch(`https://api.github.com/orgs/${org}/events`, { headers });
        const events = await res.json();
        if (Array.isArray(events)) {
          for (const event of events) {
            if (event.type === 'ReleaseEvent') {
              results.push({
                external_id: `gh_event_${event.id}`,
                category: 'model',
                title: `Release in ${org}: ${event.payload.release.name}`,
                content: event.payload.release.body,
                url: event.payload.release.html_url,
                published_at: new Date(event.created_at).toISOString(),
                checksum: await this.generateChecksum(event.payload.release.body),
                checkpoint: event.created_at
              });
            }
          }
        }
      } catch (e) { console.error(`GH Org ${org} failed:`, e); }
    }
    return results;
  }

  private async generateChecksum(text: string) {
    if (!text) return '';
    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
