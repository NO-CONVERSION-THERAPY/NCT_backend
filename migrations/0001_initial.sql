CREATE TABLE IF NOT EXISTS nct_form (
  id TEXT PRIMARY KEY,
  record_key TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS nct_databack (
  id TEXT PRIMARY KEY,
  record_key TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL,
  version INTEGER NOT NULL,
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_nct_form_record_key
  ON nct_form (record_key);

CREATE INDEX IF NOT EXISTS idx_nct_databack_record_key
  ON nct_databack (record_key);

CREATE INDEX IF NOT EXISTS idx_nct_databack_version
  ON nct_databack (version DESC);
