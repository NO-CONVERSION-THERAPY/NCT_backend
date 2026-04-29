ALTER TABLE school_media
  ADD COLUMN mother_object_sync_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE school_media
  ADD COLUMN mother_object_sync_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE school_media
  ADD COLUMN mother_object_sync_last_error TEXT;

ALTER TABLE school_media
  ADD COLUMN mother_object_sync_last_attempt_at TEXT;

ALTER TABLE school_media
  ADD COLUMN mother_object_sync_last_success_at TEXT;

CREATE INDEX IF NOT EXISTS idx_school_media_mother_object_sync
  ON school_media (mother_object_sync_status, updated_at ASC);
