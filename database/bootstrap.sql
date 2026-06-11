-- Clinical Data Database Schema

CREATE TABLE IF NOT EXISTS clinical_data_raw (
    id SERIAL PRIMARY KEY,
    study_id TEXT NOT NULL,
    study_name TEXT NOT NULL,
    study_start_date DATE,
    study_phase TEXT NOT NULL,
    participant_id TEXT NOT NULL,
    participant_dob DATE,
    participant_gender TEXT,
    participant_enrollment_date DATE,
    site_id TEXT NOT NULL,
    site_name TEXT NOT NULL,
    site_location TEXT,
    site_coordinator TEXT,
    measurement_type TEXT NOT NULL,
    measurement_value TEXT NOT NULL,
    measurement_unit TEXT,
    measurement_timestamp TIMESTAMPTZ NOT NULL,
    quality_score NUMERIC(5,4) NOT NULL,
    quality_flags TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clinical_study_id ON clinical_data_raw (study_id);
CREATE INDEX IF NOT EXISTS idx_clinical_study_quality ON clinical_data_raw (study_id, quality_score);
CREATE INDEX IF NOT EXISTS idx_clinical_study_participant ON clinical_data_raw (study_id, participant_id);
CREATE INDEX IF NOT EXISTS idx_clinical_study_site ON clinical_data_raw (study_id, site_id);
CREATE INDEX IF NOT EXISTS idx_participant_summary ON clinical_data_raw (study_id, participant_id) INCLUDE (participant_dob, participant_gender, site_id, site_name);
CREATE INDEX IF NOT EXISTS idx_clinical_measurement_timestamp ON clinical_data_raw (study_id, measurement_timestamp);
