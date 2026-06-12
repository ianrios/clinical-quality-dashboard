-- Initial schema: bare table as created at project start

CREATE TABLE IF NOT EXISTS clinical_data_raw (
    id SERIAL PRIMARY KEY,
    study_id TEXT,
    study_name TEXT,
    study_start_date TEXT,
    study_phase TEXT,
    participant_id TEXT,
    participant_name TEXT,
    participant_dob TEXT,
    participant_gender TEXT,
    participant_enrollment_date TEXT,
    site_id TEXT,
    site_name TEXT,
    site_location TEXT,
    site_coordinator TEXT,
    measurement_type TEXT,
    measurement_value TEXT,
    measurement_unit TEXT,
    measurement_timestamp TEXT,
    quality_score TEXT,
    quality_flags TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
