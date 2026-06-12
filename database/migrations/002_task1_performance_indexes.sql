-- Task 1 performance indexes
-- quality_score was TEXT at this point, so the index casts it to numeric

CREATE INDEX IF NOT EXISTS idx_clinical_study_id ON clinical_data_raw (study_id);
CREATE INDEX IF NOT EXISTS idx_clinical_study_quality ON clinical_data_raw (study_id, (quality_score::numeric));
CREATE INDEX IF NOT EXISTS idx_clinical_study_participant ON clinical_data_raw (study_id, participant_id);
CREATE INDEX IF NOT EXISTS idx_clinical_study_site ON clinical_data_raw (study_id, site_id);
