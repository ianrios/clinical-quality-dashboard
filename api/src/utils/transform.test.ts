import { parseQualityRow, parseOverviewRow, parseParticipantSummaryRow, parseEnrollmentRow, parseParticipantDetailRow, formatExecutionTime } from './transform';

// ─── parseQualityRow ──────────────────────────────────────────────────────────

describe('parseQualityRow', () => {
  const row = {
    study_id: 'ST001',
    study_name: 'Test Study',
    total_measurements: '500',
    avg_quality_score: '0.9256',
    high_quality_count: '400',
    low_quality_count: '50',
  };

  it('parses string numbers to correct numeric types', () => {
    expect(parseQualityRow(row)).toEqual({
      study_id: 'ST001',
      study_name: 'Test Study',
      total_measurements: 500,
      avg_quality_score: 0.9256,
      high_quality_count: 400,
      low_quality_count: 50,
    });
  });

  it('passes string fields through unchanged', () => {
    const result = parseQualityRow(row);
    expect(result.study_id).toBe('ST001');
    expect(result.study_name).toBe('Test Study');
  });

  it('returns NaN for non-numeric count strings', () => {
    const bad = { ...row, total_measurements: 'bad', high_quality_count: '' };
    const result = parseQualityRow(bad);
    expect(Number.isNaN(result.total_measurements)).toBe(true);
    expect(Number.isNaN(result.high_quality_count)).toBe(true);
  });

  it('returns NaN for non-numeric avg_quality_score', () => {
    const bad = { ...row, avg_quality_score: 'N/A' };
    expect(Number.isNaN(parseQualityRow(bad).avg_quality_score)).toBe(true);
  });

  it('truncates decimal part on integer columns', () => {
    const fractional = { ...row, total_measurements: '500.9' };
    expect(parseQualityRow(fractional).total_measurements).toBe(500);
  });
});

// ─── parseOverviewRow ────────────────────────────────────────────────────────

describe('parseOverviewRow', () => {
  const row = {
    study_id: 'ST001',
    study_name: 'Test Study',
    study_phase: 'Phase 2',
    participant_count: '120',
    total_measurements: '6000',
    site_count: '4',
  };

  it('parses all numeric string fields', () => {
    expect(parseOverviewRow(row)).toEqual({
      study_id: 'ST001',
      study_name: 'Test Study',
      study_phase: 'Phase 2',
      participant_count: 120,
      total_measurements: 6000,
      site_count: 4,
    });
  });

  it('passes string fields through unchanged', () => {
    const result = parseOverviewRow(row);
    expect(result.study_id).toBe('ST001');
    expect(result.study_phase).toBe('Phase 2');
  });

  it('returns NaN for non-numeric strings', () => {
    const bad = { ...row, participant_count: 'unknown' };
    expect(Number.isNaN(parseOverviewRow(bad).participant_count)).toBe(true);
  });
});

// ─── parseParticipantSummaryRow ───────────────────────────────────────────────

describe('parseParticipantSummaryRow', () => {
  // pg auto-parses json columns into arrays; the transform also accepts JSON strings
  const sitesArray = [
    { site_id: 'SITE_NY01', site_name: 'New York', participant_count: '183', male_count: '100', female_count: '83', avg_age: '45.5', min_age: '22', max_age: '74', avg_measurements: '98.0', earliest_measurement: '2022-01-01 00:00:00', latest_measurement: '2024-06-30 00:00:00' },
    { site_id: 'SITE_LA02', site_name: 'Los Angeles', participant_count: '120', male_count: '60', female_count: '60', avg_age: '48.2', min_age: '25', max_age: '70', avg_measurements: '105.5', earliest_measurement: '2022-03-01 00:00:00', latest_measurement: '2024-09-30 00:00:00' },
  ];

  const row = {
    study_id: 'CARDIO001',
    study_name: 'Cardiovascular Study',
    study_phase: 'Phase 3',
    participant_count: '500',
    avg_age: '45.7234',
    median_age: '44.5',
    mode_age: '42',
    min_age: '22',
    max_age: '74',
    male_count: '260',
    female_count: '240',
    site_count: '2',
    sites: sitesArray,
    avg_measurements_per_participant: '98.6',
    median_measurements_per_participant: '95.0',
    mode_measurements_per_participant: '87',
    earliest_measurement: '2022-01-15 10:30:00',
    latest_measurement: '2024-12-01 09:00:00',
  };

  it('parses all numeric string fields to numbers', () => {
    const result = parseParticipantSummaryRow(row);
    expect(result.participant_count).toBe(500);
    expect(result.avg_age).toBeCloseTo(45.7234);
    expect(result.median_age).toBeCloseTo(44.5);
    expect(result.mode_age).toBe(42);
    expect(result.min_age).toBe(22);
    expect(result.max_age).toBe(74);
    expect(result.male_count).toBe(260);
    expect(result.female_count).toBe(240);
    expect(result.site_count).toBe(2);
    expect(result.avg_measurements_per_participant).toBeCloseTo(98.6);
    expect(result.median_measurements_per_participant).toBeCloseTo(95.0);
    expect(result.mode_measurements_per_participant).toBe(87);
  });

  it('passes string fields through unchanged', () => {
    const result = parseParticipantSummaryRow(row);
    expect(result.study_id).toBe('CARDIO001');
    expect(result.study_name).toBe('Cardiovascular Study');
    expect(result.study_phase).toBe('Phase 3');
    expect(result.earliest_measurement).toBe('2022-01-15 10:30:00');
    expect(result.latest_measurement).toBe('2024-12-01 09:00:00');
  });

  it('parses sites from JSON array into an array with all fields', () => {
    const result = parseParticipantSummaryRow(row);
    expect(result.sites).toHaveLength(2);
    expect(result.sites[0]).toEqual({
      site_id: 'SITE_NY01', site_name: 'New York',
      participant_count: 183, male_count: 100, female_count: 83,
      avg_age: 45.5, min_age: 22, max_age: 74,
      avg_measurements: 98.0,
      earliest_measurement: '2022-01-01 00:00:00',
      latest_measurement: '2024-06-30 00:00:00',
    });
  });

  it('parses participant_count within each site as an integer', () => {
    const result = parseParticipantSummaryRow(row);
    expect(typeof result.sites[0].participant_count).toBe('number');
    expect(result.sites[0].participant_count).toBe(183);
  });

  it('parses min_age, max_age, avg_measurements, and date range within each site', () => {
    const result = parseParticipantSummaryRow(row);
    expect(result.sites[0].min_age).toBe(22);
    expect(result.sites[0].max_age).toBe(74);
    expect(result.sites[0].avg_measurements).toBeCloseTo(98.0);
    expect(result.sites[0].earliest_measurement).toBe('2022-01-01 00:00:00');
    expect(result.sites[0].latest_measurement).toBe('2024-06-30 00:00:00');
  });

  it('also accepts sites as a JSON string (fallback path)', () => {
    const withString = { ...row, sites: JSON.stringify(sitesArray) };
    const result = parseParticipantSummaryRow(withString);
    expect(result.sites).toHaveLength(2);
    expect(result.sites[0].participant_count).toBe(183);
  });

  it('returns NaN for non-numeric participant_count', () => {
    const bad = { ...row, participant_count: 'bad' };
    expect(Number.isNaN(parseParticipantSummaryRow(bad).participant_count)).toBe(true);
  });

  it('truncates avg_age to decimal via parseFloat', () => {
    const r = parseParticipantSummaryRow({ ...row, avg_age: '45.9999' });
    expect(r.avg_age).toBeCloseTo(45.9999);
  });
});

// ─── parseEnrollmentRow ───────────────────────────────────────────────────────

describe('parseEnrollmentRow', () => {
  it('parses all fields correctly (daily YYYY-MM-DD period)', () => {
    const row = { study_id: 'CARDIO001', period: '2022-03-15', count: '15' };
    expect(parseEnrollmentRow(row)).toEqual({ study_id: 'CARDIO001', period: '2022-03-15', count: 15 });
  });

  it('parses count as integer', () => {
    const row = { study_id: 'CARDIO001', period: '2022-03-15', count: '1000' };
    expect(parseEnrollmentRow(row).count).toBe(1000);
  });
});

// ─── parseParticipantDetailRow ────────────────────────────────────────────────

describe('parseParticipantDetailRow', () => {
  const row = {
    participant_id: 'PT_001',
    participant_gender: 'Female',
    age: '42',
    site_id: 'SITE_NY01',
    site_name: 'New York Medical Center',
    measurement_count: '98',
  };

  it('parses all fields correctly', () => {
    expect(parseParticipantDetailRow(row)).toEqual({
      participant_id: 'PT_001',
      participant_gender: 'Female',
      age: 42,
      site_id: 'SITE_NY01',
      site_name: 'New York Medical Center',
      measurement_count: 98,
    });
  });

  it('parses age and measurement_count as integers', () => {
    const result = parseParticipantDetailRow(row);
    expect(typeof result.age).toBe('number');
    expect(typeof result.measurement_count).toBe('number');
  });
});

// ─── formatExecutionTime ─────────────────────────────────────────────────────

describe('formatExecutionTime', () => {
  it('formats 0ms', () => {
    expect(formatExecutionTime(0)).toEqual({ executionTime: '0ms', executionTimeSeconds: 0 });
  });

  it('formats 1ms', () => {
    expect(formatExecutionTime(1)).toEqual({ executionTime: '1ms', executionTimeSeconds: 0.001 });
  });

  it('formats 1000ms as 1 second', () => {
    expect(formatExecutionTime(1000)).toEqual({ executionTime: '1000ms', executionTimeSeconds: 1 });
  });

  it('formats 1500ms as 1.5 seconds', () => {
    expect(formatExecutionTime(1500)).toEqual({ executionTime: '1500ms', executionTimeSeconds: 1.5 });
  });

  it('returns exact millisecond-to-second division', () => {
    expect(formatExecutionTime(1234)).toEqual({ executionTime: '1234ms', executionTimeSeconds: 1.234 });
  });

  it('returns exact division without rounding', () => {
    expect(formatExecutionTime(999)).toEqual({ executionTime: '999ms', executionTimeSeconds: 0.999 });
  });
});
