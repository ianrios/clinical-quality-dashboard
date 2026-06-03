export interface QualityDistribution {
  study_id: string;
  study_name: string;
  total_measurements: number;
  avg_quality_score: number;
  high_quality_count: number;
  low_quality_count: number;
}

export interface QualityDistributionResponse {
  data: QualityDistribution[];
  executionTime: string;
  executionTimeSeconds: string;
}

export interface StudyOverview {
  study_id: string;
  study_name: string;
  study_phase: string;
  participant_count: number;
  total_measurements: number;
  site_count: number;
}

export interface StudyOverviewResponse {
  data: StudyOverview[];
  executionTime: string;
  executionTimeSeconds: string;
}
