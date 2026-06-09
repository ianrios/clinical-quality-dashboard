export function parseQualityRow(row: Record<string, unknown>) {
  return {
    study_id: row.study_id as string,
    study_name: row.study_name as string,
    total_measurements: parseInt(row.total_measurements as string, 10),
    avg_quality_score: parseFloat(row.avg_quality_score as string),
    high_quality_count: parseInt(row.high_quality_count as string, 10),
    low_quality_count: parseInt(row.low_quality_count as string, 10),
  };
}

export function parseOverviewRow(row: Record<string, unknown>) {
  return {
    study_id: row.study_id as string,
    study_name: row.study_name as string,
    study_phase: row.study_phase as string,
    participant_count: parseInt(row.participant_count as string, 10),
    total_measurements: parseInt(row.total_measurements as string, 10),
    site_count: parseInt(row.site_count as string, 10),
  };
}

export function formatExecutionTime(ms: number) {
  return {
    executionTime: `${ms}ms`,
    executionTimeSeconds: (ms / 1000).toFixed(2),
  };
}
