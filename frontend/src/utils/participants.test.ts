import { describe, it, expect } from 'vitest';
import type { ParticipantSummary, SiteDistribution } from '../types';
import {
  formatPeriod, formatDateRange, formatAgeRange,
  sortParticipantRows, filterParticipantRows,
  DEFAULT_PARTICIPANT_FILTERS,
  type ParticipantFilterState,
} from './participants';

// ─── Test helpers ──────────────────────────────────────────────────────────────

function makeSite(overrides: Partial<SiteDistribution> = {}): SiteDistribution {
  return {
    site_id: 'SITE_DEFAULT', site_name: 'Default Site',
    participant_count: 100, male_count: 50, female_count: 50,
    avg_age: 45.0, min_age: 22, max_age: 74,
    avg_measurements: 98.0,
    earliest_measurement: '2022-01-01 00:00:00',
    latest_measurement: '2024-12-31 00:00:00',
    ...overrides,
  };
}

function makeRow(overrides: Partial<ParticipantSummary> = {}): ParticipantSummary {
  return {
    study_id: 'STUDY001',
    study_name: 'Test Study',
    study_phase: 'Phase 2',
    participant_count: 500,
    avg_age: 45.0,
    median_age: 44.0,
    mode_age: 42,
    min_age: 22,
    max_age: 74,
    male_count: 250,
    female_count: 250,
    site_count: 3,
    sites: [makeSite()],
    avg_measurements_per_participant: 98.5,
    median_measurements_per_participant: 95.0,
    mode_measurements_per_participant: 87,
    earliest_measurement: '2022-01-01 00:00:00',
    latest_measurement: '2024-12-31 00:00:00',
    ...overrides,
  };
}

// ─── formatPeriod ─────────────────────────────────────────────────────────────

describe('formatPeriod', () => {
  it('formats a YYYY-MM-DD date string as "Mon D \'YY"', () => {
    expect(formatPeriod('2022-01-15')).toBe("Jan 15 '22");
  });

  it('formats the first day of a month correctly', () => {
    expect(formatPeriod('2024-06-01')).toBe("Jun 1 '24");
  });

  it('formats December correctly', () => {
    expect(formatPeriod('2023-12-31')).toBe("Dec 31 '23");
  });

  it('returns empty string for empty input', () => {
    expect(formatPeriod('')).toBe('');
  });

  it('returns the original string for an unparseable input', () => {
    expect(formatPeriod('not-a-date')).toBe('not-a-date');
  });
});

// ─── formatDateRange ──────────────────────────────────────────────────────────

describe('formatDateRange', () => {
  it('formats two date strings as short month + year range', () => {
    const result = formatDateRange('2022-01-15 10:30:00', '2024-12-01 09:00:00');
    expect(result).toContain('2022');
    expect(result).toContain('2024');
    expect(result).toContain('–');
  });

  it('returns em dash for empty earliest', () => {
    expect(formatDateRange('', '2024-12-01')).toBe('—');
  });

  it('returns em dash for empty latest', () => {
    expect(formatDateRange('2022-01-01', '')).toBe('—');
  });

  it('returns em dash when both are empty', () => {
    expect(formatDateRange('', '')).toBe('—');
  });
});

// ─── formatAgeRange ───────────────────────────────────────────────────────────

describe('formatAgeRange', () => {
  it('formats min and max with en dash', () => {
    expect(formatAgeRange(22, 74)).toBe('22–74');
  });

  it('handles equal min and max', () => {
    expect(formatAgeRange(45, 45)).toBe('45–45');
  });
});

// ─── filterParticipantRows ────────────────────────────────────────────────────

describe('filterParticipantRows', () => {
  const rows = [
    makeRow({
      study_id: 'CARDIO001', study_name: 'Cardiovascular Study', study_phase: 'Phase 3',
      participant_count: 800, avg_age: 55, min_age: 30, max_age: 74,
      male_count: 480, female_count: 320,
      site_count: 3, sites: [
        makeSite({ site_id: 'SITE_NY01', site_name: 'New York Medical Center' }),
        makeSite({ site_id: 'SITE_CA01', site_name: 'California Research' }),
      ],
      avg_measurements_per_participant: 110,
      earliest_measurement: '2022-01-01 00:00:00',
      latest_measurement: '2024-12-31 00:00:00',
    }),
    makeRow({
      study_id: 'DIAB002', study_name: 'Diabetes Trial', study_phase: 'Phase 2',
      participant_count: 300, avg_age: 48, min_age: 25, max_age: 65,
      male_count: 140, female_count: 160,
      site_count: 2, sites: [
        makeSite({ site_id: 'SITE_TX01', site_name: 'Texas Clinical Center' }),
      ],
      avg_measurements_per_participant: 80,
      earliest_measurement: '2023-06-01 00:00:00',
      latest_measurement: '2025-01-31 00:00:00',
    }),
    makeRow({
      study_id: 'ONCO003', study_name: 'Oncology Research', study_phase: 'Phase 1',
      participant_count: 1200, avg_age: 62, min_age: 35, max_age: 80,
      male_count: 600, female_count: 600,
      site_count: 5, sites: [
        makeSite({ site_id: 'SITE_WA01', site_name: 'Seattle Research Center' }),
      ],
      avg_measurements_per_participant: 95,
      earliest_measurement: '2021-03-01 00:00:00',
      latest_measurement: '2023-12-31 00:00:00',
    }),
  ];

  it('returns all rows when no filters are set', () => {
    expect(filterParticipantRows(rows, DEFAULT_PARTICIPANT_FILTERS)).toHaveLength(3);
  });

  it('filters by study name case-insensitively', () => {
    const f: ParticipantFilterState = { ...DEFAULT_PARTICIPANT_FILTERS, studyName: 'diabetes' };
    const result = filterParticipantRows(rows, f);
    expect(result).toHaveLength(1);
    expect(result[0].study_id).toBe('DIAB002');
  });

  it('filters by study ID case-insensitively', () => {
    const f: ParticipantFilterState = { ...DEFAULT_PARTICIPANT_FILTERS, studyName: 'cardio001' };
    const result = filterParticipantRows(rows, f);
    expect(result).toHaveLength(1);
    expect(result[0].study_id).toBe('CARDIO001');
  });

  it('returns empty array when no study matches', () => {
    const f: ParticipantFilterState = { ...DEFAULT_PARTICIPANT_FILTERS, studyName: 'zzz' };
    expect(filterParticipantRows(rows, f)).toHaveLength(0);
  });

  it('filters by phase text', () => {
    const f: ParticipantFilterState = { ...DEFAULT_PARTICIPANT_FILTERS, phase: 'Phase 1' };
    const result = filterParticipantRows(rows, f);
    expect(result).toHaveLength(1);
    expect(result[0].study_id).toBe('ONCO003');
  });

  it('filters by phase case-insensitively', () => {
    const f: ParticipantFilterState = { ...DEFAULT_PARTICIPANT_FILTERS, phase: 'phase 3' };
    const result = filterParticipantRows(rows, f);
    expect(result).toHaveLength(1);
    expect(result[0].study_id).toBe('CARDIO001');
  });

  it('filters by minParticipants', () => {
    const f: ParticipantFilterState = { ...DEFAULT_PARTICIPANT_FILTERS, minParticipants: 900 };
    const result = filterParticipantRows(rows, f);
    expect(result).toHaveLength(1);
    expect(result[0].study_id).toBe('ONCO003');
  });

  it('filters by maxParticipants', () => {
    const f: ParticipantFilterState = { ...DEFAULT_PARTICIPANT_FILTERS, maxParticipants: 500 };
    const result = filterParticipantRows(rows, f);
    expect(result).toHaveLength(1);
    expect(result[0].study_id).toBe('DIAB002');
  });

  it('filters by minAvgAge', () => {
    const f: ParticipantFilterState = { ...DEFAULT_PARTICIPANT_FILTERS, minAvgAge: 60 };
    const result = filterParticipantRows(rows, f);
    expect(result).toHaveLength(1);
    expect(result[0].study_id).toBe('ONCO003');
  });

  it('filters by maxAvgAge', () => {
    const f: ParticipantFilterState = { ...DEFAULT_PARTICIPANT_FILTERS, maxAvgAge: 50 };
    const result = filterParticipantRows(rows, f);
    expect(result).toHaveLength(1);
    expect(result[0].study_id).toBe('DIAB002');
  });

  it('filters by ageRangeFloor (youngest participant must be at least this old)', () => {
    const f: ParticipantFilterState = { ...DEFAULT_PARTICIPANT_FILTERS, ageRangeFloor: 30 };
    const result = filterParticipantRows(rows, f);
    // DIAB002 min_age=25 excluded; CARDIO001 min_age=30, ONCO003 min_age=35 included
    expect(result).toHaveLength(2);
    expect(result.map(r => r.study_id).sort()).toEqual(['CARDIO001', 'ONCO003']);
  });

  it('filters by ageRangeCeiling (oldest participant must be at most this old)', () => {
    const f: ParticipantFilterState = { ...DEFAULT_PARTICIPANT_FILTERS, ageRangeCeiling: 74 };
    const result = filterParticipantRows(rows, f);
    // ONCO003 max_age=80 excluded; CARDIO001 max_age=74, DIAB002 max_age=65 included
    expect(result).toHaveLength(2);
    expect(result.map(r => r.study_id).sort()).toEqual(['CARDIO001', 'DIAB002']);
  });

  it('filters by minMale', () => {
    const f: ParticipantFilterState = { ...DEFAULT_PARTICIPANT_FILTERS, minMale: 500 };
    const result = filterParticipantRows(rows, f);
    expect(result).toHaveLength(1);
    expect(result[0].study_id).toBe('ONCO003');
  });

  it('filters by maxMale', () => {
    const f: ParticipantFilterState = { ...DEFAULT_PARTICIPANT_FILTERS, maxMale: 200 };
    const result = filterParticipantRows(rows, f);
    expect(result).toHaveLength(1);
    expect(result[0].study_id).toBe('DIAB002');
  });

  it('filters by minFemale', () => {
    const f: ParticipantFilterState = { ...DEFAULT_PARTICIPANT_FILTERS, minFemale: 400 };
    const result = filterParticipantRows(rows, f);
    expect(result).toHaveLength(1);
    expect(result[0].study_id).toBe('ONCO003');
  });

  it('filters by maxFemale', () => {
    const f: ParticipantFilterState = { ...DEFAULT_PARTICIPANT_FILTERS, maxFemale: 200 };
    const result = filterParticipantRows(rows, f);
    expect(result).toHaveLength(1);
    expect(result[0].study_id).toBe('DIAB002');
  });

  it('filters by siteContains matching site name', () => {
    const f: ParticipantFilterState = { ...DEFAULT_PARTICIPANT_FILTERS, siteContains: 'california' };
    const result = filterParticipantRows(rows, f);
    expect(result).toHaveLength(1);
    expect(result[0].study_id).toBe('CARDIO001');
  });

  it('filters by siteContains matching site ID', () => {
    const f: ParticipantFilterState = { ...DEFAULT_PARTICIPANT_FILTERS, siteContains: 'SITE_TX01' };
    const result = filterParticipantRows(rows, f);
    expect(result).toHaveLength(1);
    expect(result[0].study_id).toBe('DIAB002');
  });

  it('filters by siteContains returns multiple matches', () => {
    const f: ParticipantFilterState = { ...DEFAULT_PARTICIPANT_FILTERS, siteContains: 'SITE_NY01' };
    const result = filterParticipantRows(rows, f);
    expect(result).toHaveLength(1);
  });

  it('filters by minAvgMeas', () => {
    const f: ParticipantFilterState = { ...DEFAULT_PARTICIPANT_FILTERS, minAvgMeas: 100 };
    const result = filterParticipantRows(rows, f);
    expect(result).toHaveLength(1);
    expect(result[0].study_id).toBe('CARDIO001');
  });

  it('filters by maxAvgMeas', () => {
    const f: ParticipantFilterState = { ...DEFAULT_PARTICIPANT_FILTERS, maxAvgMeas: 85 };
    const result = filterParticipantRows(rows, f);
    expect(result).toHaveLength(1);
    expect(result[0].study_id).toBe('DIAB002');
  });

  it('filters by minDate (earliest_measurement must be on or after)', () => {
    const f: ParticipantFilterState = { ...DEFAULT_PARTICIPANT_FILTERS, minDate: '2022-06-01' };
    const result = filterParticipantRows(rows, f);
    // CARDIO001 earliest=2022-01-01 excluded; DIAB002 earliest=2023-06-01 included; ONCO003 earliest=2021-03-01 excluded
    expect(result).toHaveLength(1);
    expect(result[0].study_id).toBe('DIAB002');
  });

  it('filters by maxDate (latest_measurement must be on or before)', () => {
    const f: ParticipantFilterState = { ...DEFAULT_PARTICIPANT_FILTERS, maxDate: '2024-12-31' };
    const result = filterParticipantRows(rows, f);
    // DIAB002 latest=2025-01-31 excluded; CARDIO001 and ONCO003 included
    expect(result).toHaveLength(2);
    expect(result.map(r => r.study_id).sort()).toEqual(['CARDIO001', 'ONCO003']);
  });

  it('combines multiple filters with AND logic', () => {
    const f: ParticipantFilterState = {
      ...DEFAULT_PARTICIPANT_FILTERS,
      phase: 'Phase 3',
      minParticipants: 500,
    };
    const result = filterParticipantRows(rows, f);
    expect(result).toHaveLength(1);
    expect(result[0].study_id).toBe('CARDIO001');
  });
});

// ─── sortParticipantRows ──────────────────────────────────────────────────────

describe('sortParticipantRows', () => {
  const rows = [
    makeRow({ study_id: 'Z001', study_name: 'Zebra Study', participant_count: 200, avg_age: 55, site_count: 5, avg_measurements_per_participant: 90, earliest_measurement: '2023-01-01' }),
    makeRow({ study_id: 'A001', study_name: 'Alpha Study', participant_count: 1000, avg_age: 40, site_count: 2, avg_measurements_per_participant: 120, earliest_measurement: '2021-01-01' }),
    makeRow({ study_id: 'M001', study_name: 'Medium Study', participant_count: 600, avg_age: 48, site_count: 8, avg_measurements_per_participant: 75, earliest_measurement: '2022-06-01' }),
  ];

  it('sorts by study_id asc', () => {
    const result = sortParticipantRows(rows, 'study_id', 'asc');
    expect(result.map(r => r.study_id)).toEqual(['A001', 'M001', 'Z001']);
  });

  it('sorts by study_name asc', () => {
    const result = sortParticipantRows(rows, 'study_name', 'asc');
    expect(result.map(r => r.study_id)).toEqual(['A001', 'M001', 'Z001']);
  });

  it('sorts by study_name desc', () => {
    const result = sortParticipantRows(rows, 'study_name', 'desc');
    expect(result.map(r => r.study_id)).toEqual(['Z001', 'M001', 'A001']);
  });

  it('sorts by participant_count asc', () => {
    const result = sortParticipantRows(rows, 'participant_count', 'asc');
    expect(result.map(r => r.study_id)).toEqual(['Z001', 'M001', 'A001']);
  });

  it('sorts by avg_age asc', () => {
    const result = sortParticipantRows(rows, 'avg_age', 'asc');
    expect(result.map(r => r.study_id)).toEqual(['A001', 'M001', 'Z001']);
  });

  it('sorts by site_count desc', () => {
    const result = sortParticipantRows(rows, 'site_count', 'desc');
    expect(result.map(r => r.study_id)).toEqual(['M001', 'Z001', 'A001']);
  });

  it('sorts by avg_measurements_per_participant asc', () => {
    const result = sortParticipantRows(rows, 'avg_measurements_per_participant', 'asc');
    expect(result.map(r => r.study_id)).toEqual(['M001', 'Z001', 'A001']);
  });

  it('sorts by date_range using earliest_measurement', () => {
    const result = sortParticipantRows(rows, 'date_range', 'asc');
    expect(result.map(r => r.study_id)).toEqual(['A001', 'M001', 'Z001']);
  });

  it('does not mutate the input array', () => {
    const original = rows.map(r => r.study_id);
    sortParticipantRows(rows, 'study_name', 'desc');
    expect(rows.map(r => r.study_id)).toEqual(original);
  });
});
