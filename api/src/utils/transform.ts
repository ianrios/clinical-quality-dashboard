interface SiteJson {
  site_id: string;
  site_name: string;
  participant_count: string | number;
  male_count?: string | number;
  female_count?: string | number;
  avg_age?: string | number;
  min_age?: string | number;
  max_age?: string | number;
  avg_measurements?: string | number;
  earliest_measurement?: string;
  latest_measurement?: string;
}

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

export function parseParticipantSummaryRow(row: Record<string, unknown>) {
  const sitesRaw = row.sites;
  const sitesArray: SiteJson[] = typeof sitesRaw === 'string' ? JSON.parse(sitesRaw) : sitesRaw as SiteJson[];
  const sites = sitesArray.map(s => ({
    site_id: s.site_id,
    site_name: s.site_name,
    participant_count: parseInt(s.participant_count as string, 10),
    male_count: parseInt((s.male_count ?? '0') as string, 10),
    female_count: parseInt((s.female_count ?? '0') as string, 10),
    avg_age: parseFloat((s.avg_age ?? '0') as string),
    min_age: parseInt((s.min_age ?? '0') as string, 10),
    max_age: parseInt((s.max_age ?? '0') as string, 10),
    avg_measurements: parseFloat((s.avg_measurements ?? '0') as string),
    earliest_measurement: (s.earliest_measurement ?? '') as string,
    latest_measurement: (s.latest_measurement ?? '') as string,
  }));

  return {
    study_id: row.study_id as string,
    study_name: row.study_name as string,
    study_phase: row.study_phase as string,
    participant_count: parseInt(row.participant_count as string, 10),
    avg_age: parseFloat(row.avg_age as string),
    median_age: parseFloat(row.median_age as string),
    mode_age: parseInt(row.mode_age as string, 10),
    min_age: parseInt(row.min_age as string, 10),
    max_age: parseInt(row.max_age as string, 10),
    male_count: parseInt(row.male_count as string, 10),
    female_count: parseInt(row.female_count as string, 10),
    site_count: parseInt(row.site_count as string, 10),
    sites,
    avg_measurements_per_participant: parseFloat(row.avg_measurements_per_participant as string),
    median_measurements_per_participant: parseFloat(row.median_measurements_per_participant as string),
    mode_measurements_per_participant: parseInt(row.mode_measurements_per_participant as string, 10),
    earliest_measurement: row.earliest_measurement as string,
    latest_measurement: row.latest_measurement as string,
  };
}

export function parseEnrollmentRow(row: Record<string, unknown>) {
  return {
    study_id: row.study_id as string,
    period: row.period as string,
    count: parseInt(row.count as string, 10),
  };
}

export function parseParticipantDetailRow(row: Record<string, unknown>) {
  return {
    participant_id: row.participant_id as string,
    participant_gender: row.participant_gender as string,
    age: parseInt(row.age as string, 10),
    site_id: row.site_id as string,
    site_name: row.site_name as string,
    measurement_count: parseInt(row.measurement_count as string, 10),
  };
}

export function formatExecutionTime(ms: number): { executionTime: string; executionTimeSeconds: number } {
  return {
    executionTime: `${ms}ms`,
    executionTimeSeconds: ms / 1000,
  };
}
