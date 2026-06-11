export interface ApiResponse<T> {
  data: T[];
  executionTime: string;
  executionTimeSeconds: number;
}

export interface StudyOverview {
  study_id: string;
  study_name: string;
  study_phase: string;
  participant_count: number;
  total_measurements: number;
  site_count: number;
}

export type StudyOverviewResponse = ApiResponse<StudyOverview>;

export interface QualityDistribution {
  study_id: string;
  study_name: string;
  total_measurements: number;
  avg_quality_score: number;
  high_quality_count: number;
  low_quality_count: number;
}

export type QualityDistributionResponse = ApiResponse<QualityDistribution>;

export interface SiteDistribution {
  site_id: string;
  site_name: string;
  participant_count: number;
  male_count: number;
  female_count: number;
  avg_age: number;
  min_age: number;
  max_age: number;
  avg_measurements: number;
  earliest_measurement: string;
  latest_measurement: string;
}

export interface EnrollmentPoint {
  study_id: string;
  period: string;  // 'YYYY-MM-DD' daily granularity
  count: number;
}

export type EnrollmentTrendResponse = ApiResponse<EnrollmentPoint>;

export interface ParticipantDetail {
  participant_id: string;
  participant_gender: string;
  age: number;
  site_id: string;
  site_name: string;
  measurement_count: number;
}

export interface ParticipantDetailResponse extends ApiResponse<ParticipantDetail> {
  total: number;
}

export interface ParticipantSummary {
  study_id: string;
  study_name: string;
  study_phase: string;
  participant_count: number;
  avg_age: number;
  median_age: number;
  mode_age: number;
  min_age: number;
  max_age: number;
  male_count: number;
  female_count: number;
  site_count: number;
  sites: SiteDistribution[];
  avg_measurements_per_participant: number;
  median_measurements_per_participant: number;
  mode_measurements_per_participant: number;
  earliest_measurement: string;
  latest_measurement: string;
}

export type ParticipantSummaryResponse = ApiResponse<ParticipantSummary>;
