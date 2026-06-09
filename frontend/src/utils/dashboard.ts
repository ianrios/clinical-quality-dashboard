import type { StudyList, QualityDistribution } from '../types';

export type BandId = 'high' | 'medium' | 'low';
export type SortKey =
  | 'study_name' | 'total_measurements' | 'avg_quality_score'
  | 'high_quality_count' | 'medium_quality_count' | 'low_quality_count';

export interface RangeFilter { min: number | null; max: number | null; }

export interface FilterState {
  studyName: string;
  totalMeasurements: RangeFilter;
  avgQualityScore: RangeFilter;
  highQuality: RangeFilter;
  mediumQuality: RangeFilter;
  lowQuality: RangeFilter;
}

export interface ViewState {
  horizontal: boolean;
  hiddenBands: BandId[];
  zoomed: boolean;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  filters: FilterState;
  filtersLinked: boolean;
  showPercent: boolean;
}

export interface SavedView { name: string; state: ViewState; }

export interface DashboardRow {
  study: StudyList;
  quality: QualityDistribution | undefined;
  mediumCount: number | null;
}

export const ACTIVE_KEY = 'regen_quality_active';
export const ACTIVE_NAME_KEY = 'regen_quality_active_name';
export const VIEWS_KEY = 'regen_quality_views';

export const DEFAULT_FILTERS: FilterState = {
  studyName: '',
  totalMeasurements: { min: null, max: null },
  avgQualityScore: { min: null, max: null },
  highQuality: { min: null, max: null },
  mediumQuality: { min: null, max: null },
  lowQuality: { min: null, max: null },
};

export const DEFAULT_VIEW: ViewState = {
  horizontal: true,
  hiddenBands: ['medium'],
  zoomed: false,
  sortKey: 'study_name',
  sortDir: 'asc',
  filters: DEFAULT_FILTERS,
  filtersLinked: true,
  showPercent: true,
};

export function truncate(name: string, max = 30): string {
  return name.length > max ? name.substring(0, max) + '...' : name;
}

export function formatAvgQuality(score: number, showPercent: boolean): string {
  return showPercent ? `${(score * 100).toFixed(1)}%` : score.toFixed(4);
}

export function computeMediumCount(quality: QualityDistribution | undefined): number | null {
  if (!quality) return null;
  return quality.total_measurements - quality.high_quality_count - quality.low_quality_count;
}

function checkRange(val: number, f: RangeFilter): boolean {
  return (f.min === null || val >= f.min) && (f.max === null || val <= f.max);
}

export function filterRows(rows: DashboardRow[], filters: FilterState): DashboardRow[] {
  return rows.filter(({ study, quality, mediumCount }) => {
    if (filters.studyName) {
      const q = filters.studyName.toLowerCase();
      if (
        !study.study_name.toLowerCase().includes(q) &&
        !study.study_id.toLowerCase().includes(q)
      ) return false;
    }
    if (!quality) return true;
    if (!checkRange(quality.total_measurements, filters.totalMeasurements)) return false;
    if (!checkRange(quality.avg_quality_score, filters.avgQualityScore)) return false;
    if (!checkRange(quality.high_quality_count, filters.highQuality)) return false;
    if (mediumCount !== null && !checkRange(mediumCount, filters.mediumQuality)) return false;
    if (!checkRange(quality.low_quality_count, filters.lowQuality)) return false;
    return true;
  });
}

export function sortRows(
  rows: DashboardRow[],
  sortKey: SortKey,
  sortDir: 'asc' | 'desc',
): DashboardRow[] {
  return [...rows].sort((a, b) => {
    let av: string | number = 0, bv: string | number = 0;
    switch (sortKey) {
      case 'study_name':           av = a.study.study_name;                  bv = b.study.study_name; break;
      case 'total_measurements':   av = a.quality?.total_measurements ?? 0;  bv = b.quality?.total_measurements ?? 0; break;
      case 'avg_quality_score':    av = a.quality?.avg_quality_score ?? 0;   bv = b.quality?.avg_quality_score ?? 0; break;
      case 'high_quality_count':   av = a.quality?.high_quality_count ?? 0;  bv = b.quality?.high_quality_count ?? 0; break;
      case 'medium_quality_count': av = a.mediumCount ?? 0;                  bv = b.mediumCount ?? 0; break;
      case 'low_quality_count':    av = a.quality?.low_quality_count ?? 0;   bv = b.quality?.low_quality_count ?? 0; break;
    }
    if (typeof av === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
    }
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });
}

export function computeZoomDomain(
  chartData: Record<string, string | number>[],
  visibleKeys: string[],
): [number, number] {
  const vals = chartData
    .flatMap(row => visibleKeys.map(k => row[k] as number))
    .filter(v => Number.isFinite(v));
  const rMin = vals.length ? Math.min(...vals) : 0;
  const rMax = vals.length ? Math.max(...vals) : 100000;
  const p = Math.max((rMax - rMin) * 0.05, 1);
  return [Math.max(0, Math.floor(rMin - p)), Math.ceil(rMax + p)];
}

export function loadActiveView(): ViewState {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_VIEW, ...parsed, filters: { ...DEFAULT_FILTERS, ...parsed.filters } };
    }
  } catch {}
  return DEFAULT_VIEW;
}

export function loadActiveViewName(): string {
  try { return localStorage.getItem(ACTIVE_NAME_KEY) ?? 'Default'; } catch { return 'Default'; }
}

export function loadSavedViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(VIEWS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function persistViews(views: SavedView[]): void {
  try { localStorage.setItem(VIEWS_KEY, JSON.stringify(views)); } catch {}
}
