ALTER TABLE nct_form
  ADD COLUMN data_source_type TEXT NOT NULL DEFAULT 'questionnaire';

ALTER TABLE nct_databack
  ADD COLUMN data_source_type TEXT NOT NULL DEFAULT 'questionnaire';

CREATE INDEX IF NOT EXISTS idx_nct_form_data_source_type
  ON nct_form (data_source_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_nct_databack_data_source_type
  ON nct_databack (data_source_type, updated_at DESC);
