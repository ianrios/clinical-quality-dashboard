import { describe, it, expect, beforeEach } from 'vitest';
import type { QualityDistribution } from '../types';
import {
  truncate, formatAvgQuality, computeMediumCount,
  filterRows, sortRows, computeZoomDomain,
  loadActiveView, loadActiveViewName, loadSavedViews, persistViews,
  DEFAULT_VIEW, DEFAULT_FILTERS, ACTIVE_KEY, ACTIVE_NAME_KEY, VIEWS_KEY,
  type DashboardRow, type FilterState,
} from './dashboard';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeQuality(overrides: Partial<QualityDistribution> = {}): QualityDistribution {
  return {
    study_id: 'ST001',
    study_name: 'Test Study',
    total_measurements: 1000,
    avg_quality_score: 0.92,
    high_quality_count: 800,
    low_quality_count: 50,
    ...overrides,
  };
}

function makeRow(
  name: string,
  id: string,
  quality?: Partial<QualityDistribution> | null,
): DashboardRow {
  const q = quality === null ? undefined : makeQuality({ study_id: id, study_name: name, ...quality });
  const mediumCount = q ? q.total_measurements - q.high_quality_count - q.low_quality_count : null;
  return {
    study: { study_id: id, study_name: name, study_phase: 'Phase 1' },
    quality: q,
    mediumCount,
  };
}

const noFilters: FilterState = DEFAULT_FILTERS;

// ─── truncate ─────────────────────────────────────────────────────────────────

describe('truncate', () => {
  it('returns short names unchanged', () => {
    expect(truncate('Short')).toBe('Short');
  });

  it('returns names exactly at limit unchanged', () => {
    const exactly30 = 'a'.repeat(30);
    expect(truncate(exactly30)).toBe(exactly30);
  });

  it('truncates names over the limit with ellipsis', () => {
    const long = 'a'.repeat(31);
    expect(truncate(long)).toBe('a'.repeat(30) + '...');
  });

  it('uses a custom max length', () => {
    expect(truncate('Hello World', 5)).toBe('Hello...');
  });

  it('handles empty string', () => {
    expect(truncate('')).toBe('');
  });
});

// ─── formatAvgQuality ────────────────────────────────────────────────────────

describe('formatAvgQuality', () => {
  it('formats as percentage when showPercent is true', () => {
    expect(formatAvgQuality(0.92, true)).toBe('92.0%');
    expect(formatAvgQuality(0.8, true)).toBe('80.0%');
    expect(formatAvgQuality(1, true)).toBe('100.0%');
    expect(formatAvgQuality(0, true)).toBe('0.0%');
  });

  it('formats as decimal when showPercent is false', () => {
    expect(formatAvgQuality(0.92, false)).toBe('0.9200');
    expect(formatAvgQuality(1, false)).toBe('1.0000');
    expect(formatAvgQuality(0, false)).toBe('0.0000');
  });

  it('rounds to one decimal in percent mode', () => {
    expect(formatAvgQuality(0.925, true)).toBe('92.5%');
    expect(formatAvgQuality(0.9256, true)).toBe('92.6%');
  });

  it('rounds to four decimals in decimal mode', () => {
    expect(formatAvgQuality(0.92561, false)).toBe('0.9256');
  });
});

// ─── computeMediumCount ───────────────────────────────────────────────────────

describe('computeMediumCount', () => {
  it('returns total minus high minus low', () => {
    expect(computeMediumCount(makeQuality({ total_measurements: 1000, high_quality_count: 800, low_quality_count: 50 }))).toBe(150);
  });

  it('returns null when quality is undefined', () => {
    expect(computeMediumCount(undefined)).toBeNull();
  });

  it('handles zero medium count', () => {
    expect(computeMediumCount(makeQuality({ total_measurements: 100, high_quality_count: 80, low_quality_count: 20 }))).toBe(0);
  });

  it('can return negative when data is inconsistent', () => {
    // No guard — callers should not produce this, but we document the behaviour
    expect(computeMediumCount(makeQuality({ total_measurements: 100, high_quality_count: 90, low_quality_count: 20 }))).toBe(-10);
  });
});

// ─── filterRows ───────────────────────────────────────────────────────────────

describe('filterRows', () => {
  const rows = [
    makeRow('Cardiovascular Study', 'CARDIO001'),
    makeRow('Diabetes Trial', 'DIABETES002', { avg_quality_score: 0.75, high_quality_count: 400, low_quality_count: 300 }),
    makeRow('Oncology Research', 'ONCO003', { total_measurements: 2000, high_quality_count: 1800 }),
  ];

  it('returns all rows when no filters are set', () => {
    expect(filterRows(rows, noFilters)).toHaveLength(3);
  });

  it('filters by study name case-insensitively', () => {
    const f: FilterState = { ...noFilters, studyName: 'diabetes' };
    expect(filterRows(rows, f)).toHaveLength(1);
    expect(filterRows(rows, f)[0].study.study_id).toBe('DIABETES002');
  });

  it('filters by study ID case-insensitively', () => {
    const f: FilterState = { ...noFilters, studyName: 'cardio001' };
    expect(filterRows(rows, f)).toHaveLength(1);
  });

  it('returns empty when no study matches the name filter', () => {
    const f: FilterState = { ...noFilters, studyName: 'zzznomatch' };
    expect(filterRows(rows, f)).toHaveLength(0);
  });

  it('passes rows with missing quality data through range filters', () => {
    const rowsWithNull = [makeRow('No Quality', 'NQ001', null)];
    const f: FilterState = { ...noFilters, totalMeasurements: { min: 9999, max: null } };
    expect(filterRows(rowsWithNull, f)).toHaveLength(1);
  });

  it('filters by totalMeasurements min', () => {
    const f: FilterState = { ...noFilters, totalMeasurements: { min: 1500, max: null } };
    const result = filterRows(rows, f);
    expect(result).toHaveLength(1);
    expect(result[0].study.study_id).toBe('ONCO003');
  });

  it('filters by totalMeasurements max', () => {
    const f: FilterState = { ...noFilters, totalMeasurements: { min: null, max: 999 } };
    const result = filterRows(rows, f);
    expect(result.every(r => (r.quality?.total_measurements ?? 0) <= 999)).toBe(true);
  });

  it('filters by avgQualityScore range', () => {
    const f: FilterState = { ...noFilters, avgQualityScore: { min: 0.8, max: null } };
    const result = filterRows(rows, f);
    // DIABETES002 has avg 0.75 so should be excluded
    expect(result.find(r => r.study.study_id === 'DIABETES002')).toBeUndefined();
  });

  it('filters by highQuality count', () => {
    const f: FilterState = { ...noFilters, highQuality: { min: 1000, max: null } };
    const result = filterRows(rows, f);
    expect(result).toHaveLength(1);
    expect(result[0].study.study_id).toBe('ONCO003');
  });

  it('filters by mediumQuality range when mediumCount is set', () => {
    const f: FilterState = { ...noFilters, mediumQuality: { min: 200, max: null } };
    const result = filterRows(rows, f);
    // CARDIO001: medium = 1000-800-50 = 150 → excluded
    // DIABETES002: medium = 1000-400-300 = 300 → included
    // ONCO003: medium = 2000-1800-50 = 150 → excluded
    expect(result).toHaveLength(1);
    expect(result[0].study.study_id).toBe('DIABETES002');
  });

  it('combines study name and range filters with AND logic', () => {
    const f: FilterState = {
      ...noFilters,
      studyName: 'cardio',
      avgQualityScore: { min: 0.9, max: null },
    };
    expect(filterRows(rows, f)).toHaveLength(1);
    expect(filterRows(rows, f)[0].study.study_id).toBe('CARDIO001');
  });
});

// ─── sortRows ─────────────────────────────────────────────────────────────────

describe('sortRows', () => {
  const rows = [
    makeRow('Zebra Study', 'Z001', { total_measurements: 500, avg_quality_score: 0.88, high_quality_count: 400, low_quality_count: 50 }),
    makeRow('Alpha Study', 'A001', { total_measurements: 2000, avg_quality_score: 0.95, high_quality_count: 1900, low_quality_count: 30 }),
    makeRow('Medium Study', 'M001', { total_measurements: 1000, avg_quality_score: 0.72, high_quality_count: 600, low_quality_count: 300 }),
  ];

  it('sorts by study_name asc', () => {
    const result = sortRows(rows, 'study_name', 'asc');
    expect(result.map(r => r.study.study_id)).toEqual(['A001', 'M001', 'Z001']);
  });

  it('sorts by study_name desc', () => {
    const result = sortRows(rows, 'study_name', 'desc');
    expect(result.map(r => r.study.study_id)).toEqual(['Z001', 'M001', 'A001']);
  });

  it('sorts by total_measurements asc', () => {
    const result = sortRows(rows, 'total_measurements', 'asc');
    expect(result.map(r => r.study.study_id)).toEqual(['Z001', 'M001', 'A001']);
  });

  it('sorts by total_measurements desc', () => {
    const result = sortRows(rows, 'total_measurements', 'desc');
    expect(result.map(r => r.study.study_id)).toEqual(['A001', 'M001', 'Z001']);
  });

  it('sorts by avg_quality_score asc', () => {
    const result = sortRows(rows, 'avg_quality_score', 'asc');
    expect(result.map(r => r.study.study_id)).toEqual(['M001', 'Z001', 'A001']);
  });

  it('sorts by high_quality_count desc', () => {
    const result = sortRows(rows, 'high_quality_count', 'desc');
    expect(result.map(r => r.study.study_id)).toEqual(['A001', 'M001', 'Z001']);
  });

  it('sorts by medium_quality_count asc (uses computed mediumCount)', () => {
    // Z001: 500-400-50=50, A001: 2000-1900-30=70, M001: 1000-600-300=100
    const result = sortRows(rows, 'medium_quality_count', 'asc');
    expect(result.map(r => r.study.study_id)).toEqual(['Z001', 'A001', 'M001']);
  });

  it('sorts by low_quality_count asc', () => {
    const result = sortRows(rows, 'low_quality_count', 'asc');
    expect(result.map(r => r.study.study_id)).toEqual(['A001', 'Z001', 'M001']);
  });

  it('defaults missing quality to 0 for numeric sorts', () => {
    const withNull = [
      makeRow('Has Quality', 'HQ', { total_measurements: 500 }),
      makeRow('No Quality', 'NQ', null),
    ];
    const result = sortRows(withNull, 'total_measurements', 'asc');
    expect(result[0].study.study_id).toBe('NQ');
  });

  it('does not mutate the input array', () => {
    const original = [...rows];
    sortRows(rows, 'study_name', 'desc');
    expect(rows[0].study.study_id).toBe(original[0].study.study_id);
  });
});

// ─── computeZoomDomain ───────────────────────────────────────────────────────

describe('computeZoomDomain', () => {
  it('returns [0, 105000] for empty data', () => {
    const [lo, hi] = computeZoomDomain([], ['High']);
    expect(lo).toBe(0);
    expect(hi).toBe(105000);
  });

  it('pads a single value by at least 1 on each side', () => {
    const data = [{ High: 50 }];
    const [lo, hi] = computeZoomDomain(data, ['High']);
    expect(lo).toBe(49);
    expect(hi).toBe(51);
  });

  it('clamps the lower bound to 0', () => {
    const data = [{ High: 0 }];
    const [lo, hi] = computeZoomDomain(data, ['High']);
    expect(lo).toBe(0);
    expect(hi).toBe(1);
  });

  it('computes 5% padding for a normal range', () => {
    const data = [{ High: 100 }, { High: 200 }];
    // range=100, p=5, lo=floor(100-5)=95, hi=ceil(200+5)=205
    const [lo, hi] = computeZoomDomain(data, ['High']);
    expect(lo).toBe(95);
    expect(hi).toBe(205);
  });

  it('only considers visible keys', () => {
    const data = [{ High: 1000, Low: 5 }];
    const [lo, hi] = computeZoomDomain(data, ['Low']);
    expect(lo).toBe(4);
    expect(hi).toBe(6);
  });

  it('spans across multiple rows and keys', () => {
    const data = [{ High: 50, Low: 200 }, { High: 10, Low: 500 }];
    // visible: [50, 200, 10, 500], min=10, max=500, range=490, p=max(24.5,1)=24.5
    // lo=floor(10-24.5)=floor(-14.5)=-15 → max(0,-15)=0, hi=ceil(500+24.5)=525
    const [lo, hi] = computeZoomDomain(data, ['High', 'Low']);
    expect(lo).toBe(0);
    expect(hi).toBe(525);
  });
});

// ─── localStorage helpers ─────────────────────────────────────────────────────

describe('loadActiveView', () => {
  beforeEach(() => { localStorage.clear(); });

  it('returns DEFAULT_VIEW when nothing is stored', () => {
    expect(loadActiveView()).toEqual(DEFAULT_VIEW);
  });

  it('merges stored values over defaults', () => {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify({ horizontal: false }));
    const result = loadActiveView();
    expect(result.horizontal).toBe(false);
    expect(result.sortKey).toBe('study_name'); // from DEFAULT_VIEW
  });

  it('merges stored filters over default filters', () => {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify({ filters: { studyName: 'cardio' } }));
    const result = loadActiveView();
    expect(result.filters.studyName).toBe('cardio');
    expect(result.filters.totalMeasurements).toEqual({ min: null, max: null });
  });

  it('returns DEFAULT_VIEW when stored JSON is corrupted', () => {
    localStorage.setItem(ACTIVE_KEY, '{not valid json{{');
    expect(loadActiveView()).toEqual(DEFAULT_VIEW);
  });
});

describe('loadActiveViewName', () => {
  beforeEach(() => { localStorage.clear(); });

  it('returns "Default" when nothing is stored', () => {
    expect(loadActiveViewName()).toBe('Default');
  });

  it('returns the stored name', () => {
    localStorage.setItem(ACTIVE_NAME_KEY, 'My View');
    expect(loadActiveViewName()).toBe('My View');
  });
});

describe('loadSavedViews', () => {
  beforeEach(() => { localStorage.clear(); });

  it('returns empty array when nothing is stored', () => {
    expect(loadSavedViews()).toEqual([]);
  });

  it('returns stored views', () => {
    const views = [{ name: 'View A', state: DEFAULT_VIEW }];
    localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
    expect(loadSavedViews()).toEqual(views);
  });

  it('returns empty array on corrupted JSON', () => {
    localStorage.setItem(VIEWS_KEY, 'bad json!!!');
    expect(loadSavedViews()).toEqual([]);
  });
});

describe('persistViews', () => {
  beforeEach(() => { localStorage.clear(); });

  it('writes views to localStorage', () => {
    const views = [{ name: 'View A', state: DEFAULT_VIEW }];
    persistViews(views);
    expect(JSON.parse(localStorage.getItem(VIEWS_KEY)!)).toEqual(views);
  });

  it('overwrites previously stored views', () => {
    persistViews([{ name: 'Old', state: DEFAULT_VIEW }]);
    persistViews([{ name: 'New', state: DEFAULT_VIEW }]);
    const stored = JSON.parse(localStorage.getItem(VIEWS_KEY)!) as { name: string }[];
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('New');
  });
});
