ALTER TABLE nct_form
  ADD COLUMN mother_sync_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE nct_form
  ADD COLUMN mother_sync_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE nct_form
  ADD COLUMN mother_sync_last_error TEXT;

ALTER TABLE nct_form
  ADD COLUMN mother_sync_last_attempt_at TEXT;

ALTER TABLE nct_form
  ADD COLUMN mother_sync_last_success_at TEXT;

ALTER TABLE nct_form
  ADD COLUMN mother_assigned_version INTEGER;

ALTER TABLE nct_databack
  ADD COLUMN payload_encryption_state TEXT NOT NULL DEFAULT 'plain-json';

CREATE INDEX IF NOT EXISTS idx_nct_form_mother_sync_status
  ON nct_form (mother_sync_status, updated_at DESC);
