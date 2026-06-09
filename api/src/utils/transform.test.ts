import { parseQualityRow, parseOverviewRow, formatExecutionTime } from './transform';

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

// ─── formatExecutionTime ─────────────────────────────────────────────────────

describe('formatExecutionTime', () => {
  it('formats 0ms', () => {
    expect(formatExecutionTime(0)).toEqual({ executionTime: '0ms', executionTimeSeconds: '0.00' });
  });

  it('formats 1ms', () => {
    expect(formatExecutionTime(1)).toEqual({ executionTime: '1ms', executionTimeSeconds: '0.00' });
  });

  it('formats 1000ms as 1.00 seconds', () => {
    expect(formatExecutionTime(1000)).toEqual({ executionTime: '1000ms', executionTimeSeconds: '1.00' });
  });

  it('formats 1500ms as 1.50 seconds', () => {
    expect(formatExecutionTime(1500)).toEqual({ executionTime: '1500ms', executionTimeSeconds: '1.50' });
  });

  it('truncates seconds to 2 decimal places', () => {
    expect(formatExecutionTime(1234)).toEqual({ executionTime: '1234ms', executionTimeSeconds: '1.23' });
  });

  it('handles fractional milliseconds', () => {
    expect(formatExecutionTime(999)).toEqual({ executionTime: '999ms', executionTimeSeconds: '1.00' });
  });
});
