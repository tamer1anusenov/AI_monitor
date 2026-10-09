# Database Contract: AI Research Radar

## 1. Tables

### radar_sources
Configuration for data sources.
- id: uuid (PK)
- name: text (unique, e.g., 'arxiv_cs_ai')
- type: text (e.g., 'arxiv', 'hf_papers', 'github', 'web')
- config: jsonb (adapter-specific settings: categories, orgs, etc.)
- last_checkpoint: text (last processed ID/timestamp/page)
- is_enabled: boolean (default true)
- updated_at: timestamptz

### radar_items
The raw collected items.
- id: uuid (PK)
- source_id: uuid (FK -> radar_sources)
- external_id: text (unique ID from the source)
- category: text (paper, model, tool, news)
- title: text
- content: text (raw markdown/text)
- url: text (unique)
- published_at: timestamptz
- checksum: text (SHA256 of content for change detection)
- created_at: timestamptz
- updated_at: timestamptz

### radar_queue
Queue for items awaiting analysis.
- id: uuid (PK)
- item_id: uuid (FK -> radar_items)
- status: text (pending, processing, failed)
- attempts: int (default 0)
- lease_expires_at: timestamptz
- last_error: text
- created_at: timestamptz

## 2. RPC Signatures

### claim_queue_items(limit_count int, lease_duration interval)
Atomic claiming of pending or expired items.
- Returns: table(id uuid, item_id uuid)
- Logic: 
  UPDATE radar_queue 
  SET status = 'processing', 
      lease_expires_at = now() + lease_duration, 
      attempts = attempts + 1
  WHERE id IN (
    SELECT id FROM radar_queue 
    WHERE status = 'pending' OR (status = 'processing' AND lease_expires_at < now())
    ORDER BY created_at ASC 
    LIMIT limit_count 
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id, item_id;

### complete_queue_item(queue_id uuid)
Marks an item as finished.
- Returns: void
- Logic: DELETE FROM radar_queue WHERE id = queue_id;

### fail_queue_item(queue_id uuid, error_msg text)
Marks an item as failed and returns it to pending if attempts < MAX.
- Returns: void
- Logic: 
  UPDATE radar_queue 
  SET status = CASE WHEN attempts < 3 THEN 'pending' ELSE 'failed' END, 
      last_error = error_msg, 
      lease_expires_at = NULL 
  WHERE id = queue_id;

## 3. Example Rows

### radar_sources
| name | type | config | last_checkpoint | is_enabled |
|---|---|---|---|---|
| arxiv_ai | arxiv | {"categories": ["cs.AI", "cs.LG"]} | "2023-10-01" | true |
| hf_papers | hf | {} | "page_1" | true |

### radar_items
| category | title | url | published_at |
|---|---|---|---|
| paper | "Attention is All You Need" | "https://arxiv.org/abs/..." | "2017-06-12" |
| model | "Qwen2-7B" | "https://github.com/..." | "2024-06-01" |
