
import os
from supabase import create_client, Client

# Environment variables
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise EnvironmentError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

def get_enabled_sources():
    res = supabase.table('radar_sources').select('*').eq('is_enabled', True).execute()
    return res.data

def update_checkpoint(source_id: str, checkpoint: str):
    supabase.table('radar_sources').update({'last_checkpoint': checkpoint, 'updated_at': 'now()'})        .eq('id', source_id).execute()

def upsert_item(item_data: dict):
    # Use external_id and source_id for uniqueness as per schema
    res = supabase.table('radar_items').upsert(item_data, on_conflict='source_id,external_id').execute()
    return res.data[0] if res.data else None

def enqueue_analysis(item_id: str):
    supabase.table('radar_queue').insert({'item_id': item_id, 'status': 'pending'}).execute()
