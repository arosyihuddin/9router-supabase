-- Supabase Setup Script for 9Router - UPDATED VERSION
-- Run this in your Supabase SQL Editor to set up the database

-- 1. Drop old function if exists
DROP FUNCTION IF EXISTS exec_sql(text, jsonb);

-- 2. Create new exec_sql function that handles both queries and commands
CREATE OR REPLACE FUNCTION exec_sql(query text, params jsonb DEFAULT '[]')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec record;
  results jsonb := '[]'::jsonb;
  is_select boolean;
BEGIN
  -- Check if this is a SELECT query
  is_select := query ~* '^\s*SELECT';

  -- For SELECT queries, collect results
  IF is_select THEN
    FOR rec IN EXECUTE query LOOP
      results := jsonb_insert(results, array[jsonb_array_length(results)::text], to_jsonb(rec));
    END LOOP;
  ELSE
    -- For non-SELECT (INSERT/UPDATE/DELETE/BEGIN/COMMIT/etc), just execute
    EXECUTE query;
    results := jsonb_build_array(jsonb_build_object('success', true));
  END IF;

  RETURN results;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_array(jsonb_build_object(
      'error', SQLERRM,
      'detail', SQLSTATE
    ));
END;
$$;

-- 3. Create all tables (use lowercase for Postgres compatibility)
CREATE TABLE IF NOT EXISTS _meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS providerconnections (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  authtype TEXT NOT NULL,
  name TEXT,
  email TEXT,
  priority INTEGER,
  isactive INTEGER DEFAULT 1,
  data TEXT NOT NULL,
  createdat TEXT NOT NULL,
  updatedat TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pc_provider ON providerconnections(provider);
CREATE INDEX IF NOT EXISTS idx_pc_provider_active ON providerconnections(provider, isactive);
CREATE INDEX IF NOT EXISTS idx_pc_priority ON providerconnections(provider, priority);

CREATE TABLE IF NOT EXISTS providernodes (
  id TEXT PRIMARY KEY,
  type TEXT,
  name TEXT,
  data TEXT NOT NULL,
  createdat TEXT NOT NULL,
  updatedat TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pn_type ON providernodes(type);

CREATE TABLE IF NOT EXISTS proxypools (
  id TEXT PRIMARY KEY,
  isactive INTEGER DEFAULT 1,
  teststatus TEXT,
  data TEXT NOT NULL,
  createdat TEXT NOT NULL,
  updatedat TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pp_active ON proxypools(isactive);
CREATE INDEX IF NOT EXISTS idx_pp_status ON proxypools(teststatus);

CREATE TABLE IF NOT EXISTS apikeys (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  name TEXT,
  machineid TEXT,
  isactive INTEGER DEFAULT 1,
  createdat TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ak_key ON apikeys(key);

CREATE TABLE IF NOT EXISTS combos (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  kind TEXT,
  models TEXT NOT NULL,
  createdat TEXT NOT NULL,
  updatedat TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_combo_name ON combos(name);

CREATE TABLE IF NOT EXISTS kv (
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (scope, key)
);

CREATE INDEX IF NOT EXISTS idx_kv_scope ON kv(scope);

CREATE TABLE IF NOT EXISTS usagehistory (
  id SERIAL PRIMARY KEY,
  timestamp TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  connectionid TEXT,
  apikey TEXT,
  endpoint TEXT,
  prompttokens INTEGER DEFAULT 0,
  completiontokens INTEGER DEFAULT 0,
  cost REAL DEFAULT 0,
  status TEXT,
  tokens TEXT,
  meta TEXT
);

CREATE INDEX IF NOT EXISTS idx_uh_ts ON usagehistory(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_uh_provider ON usagehistory(provider);
CREATE INDEX IF NOT EXISTS idx_uh_model ON usagehistory(model);
CREATE INDEX IF NOT EXISTS idx_uh_conn ON usagehistory(connectionid);

CREATE TABLE IF NOT EXISTS usagedaily (
  datekey TEXT PRIMARY KEY,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS requestdetails (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  connectionid TEXT,
  status TEXT,
  data TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rd_ts ON requestdetails(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_rd_provider ON requestdetails(provider);
CREATE INDEX IF NOT EXISTS idx_rd_model ON requestdetails(model);
CREATE INDEX IF NOT EXISTS idx_rd_conn ON requestdetails(connectionid);

-- 4. Disable Row Level Security (RLS) for service role access
ALTER TABLE _meta DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE providerconnections DISABLE ROW LEVEL SECURITY;
ALTER TABLE providernodes DISABLE ROW LEVEL SECURITY;
ALTER TABLE proxypools DISABLE ROW LEVEL SECURITY;
ALTER TABLE apikeys DISABLE ROW LEVEL SECURITY;
ALTER TABLE combos DISABLE ROW LEVEL SECURITY;
ALTER TABLE kv DISABLE ROW LEVEL SECURITY;
ALTER TABLE usagehistory DISABLE ROW LEVEL SECURITY;
ALTER TABLE usagedaily DISABLE ROW LEVEL SECURITY;
ALTER TABLE requestdetails DISABLE ROW LEVEL SECURITY;

-- 5. Insert initial schema version
INSERT INTO _meta (key, value) VALUES ('schema_version', '1')
ON CONFLICT (key) DO UPDATE SET value = '1';

-- Done! Your Supabase database is ready for 9Router.
