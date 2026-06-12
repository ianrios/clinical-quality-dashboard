-- Task 2 schema tightening and new performance indexes
-- Enforces NOT NULL, proper column types, drops unused participant_name column
-- Replaces the quality_score expression index with a plain column index now that the type is NUMERIC

ALTER TABLE clinical_data_raw
    DROP COLUMN IF EXISTS participant_name,
    ALTER COLUMN study_id SET NOT NULL,
    ALTER COLUMN study_name SET NOT NULL,
    ALTER COLUMN study_phase SET NOT NULL,
    ALTER COLUMN participant_id SET NOT NULL,
    ALTER COLUMN site_id SET NOT NULL,
    ALTER COLUMN site_name SET NOT NULL,
    ALTER COLUMN measurement_type SET NOT NULL,
    ALTER COLUMN measurement_value SET NOT NULL,
    ALTER COLUMN measurement_timestamp SET NOT NULL,
    ALTER COLUMN measurement_timestamp TYPE TIMESTAMPTZ USING measurement_timestamp::TIMESTAMPTZ,
    ALTER COLUMN quality_score SET NOT NULL,
    ALTER COLUMN quality_score TYPE NUMERIC(5,4) USING quality_score::NUMERIC(5,4),
    ALTER COLUMN study_start_date TYPE DATE USING study_start_date::DATE,
    ALTER COLUMN participant_dob TYPE DATE USING participant_dob::DATE,
    ALTER COLUMN participant_enrollment_date TYPE DATE USING participant_enrollment_date::DATE;

-- Rebuild the quality index without the cast now that the column is NUMERIC
DROP INDEX IF EXISTS idx_clinical_study_quality;
CREATE INDEX IF NOT EXISTS idx_clinical_study_quality ON clinical_data_raw (study_id, quality_score);

-- New indexes for participant summary and time-range queries
CREATE INDEX IF NOT EXISTS idx_participant_summary ON clinical_data_raw (study_id, participant_id) INCLUDE (participant_dob, participant_gender, site_id, site_name);
CREATE INDEX IF NOT EXISTS idx_clinical_measurement_timestamp ON clinical_data_raw (study_id, measurement_timestamp);
