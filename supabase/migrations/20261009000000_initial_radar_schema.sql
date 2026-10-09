
-- AI Research Radar Initial Schema
CREATE TABLE IF NOT EXISTS radar_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    config JSONB DEFAULT '{}'::jsonb,
    last_checkpoint TEXT,
    is_enabled BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS radar_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES radar_sources(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    category TEXT CHECK (category IN ('paper', 'model', 'tool', 'news')),
    title TEXT NOT NULL,
    content TEXT,
    url TEXT UNIQUE NOT NULL,
    published_at TIMESTAMPTZ,
    checksum TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(source_id, external_id)
);

CREATE TABLE IF NOT EXISTS radar_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES radar_items(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'failed')),
    attempts INT DEFAULT 0,
    lease_expires_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_radar_items_url ON radar_items(url);
CREATE INDEX IF NOT EXISTS idx_radar_queue_status_lease ON radar_queue(status, lease_expires_at);

-- RLS
ALTER TABLE radar_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE radar_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE radar_queue ENABLE ROW LEVEL SECURITY;

-- Only service_role can access these (backend-only)
CREATE POLICY "Service role full access sources" ON radar_sources TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access items" ON radar_items TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access queue" ON radar_queue TO service_role USING (true) WITH CHECK (true);

-- Queue claiming RPC
CREATE OR REPLACE FUNCTION claim_queue_items(limit_count INT, lease_duration INTERVAL)
RETURNS TABLE(id UUID, item_id UUID) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    UPDATE radar_queue
    SET status = 'processing',
        lease_expires_at = now() + lease_duration,
        attempts = attempts + 1
    WHERE radar_queue.id IN (
        SELECT q.id FROM radar_queue q
        WHERE q.status = 'pending' OR (q.status = 'processing' AND q.lease_expires_at < now())
        ORDER BY q.created_at ASC
        LIMIT limit_count
        FOR UPDATE SKIP LOCKED
    )
    RETURNING radar_queue.id, radar_queue.item_id;
END;
$$;

-- Complete item RPC
CREATE OR REPLACE FUNCTION complete_queue_item(queue_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM radar_queue WHERE id = queue_id;
END;
$$;

-- Fail item RPC
CREATE OR REPLACE FUNCTION fail_queue_item(queue_id UUID, error_msg TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    UPDATE radar_queue
    SET status = CASE WHEN attempts < 3 THEN 'pending' ELSE 'failed' END,
        last_error = error_msg,
        lease_expires_at = NULL
    WHERE id = queue_id;
END;
$$;
