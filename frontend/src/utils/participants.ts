import type { ParticipantSummary } from '../types';

export type ParticipantSortKey =
  | 'study_id' | 'study_name' | 'study_phase' | 'participant_count'
  | 'avg_age' | 'age_range' | 'male_count' | 'female_count'
  | 'site_count' | 'avg_measurements_per_participant' | 'date_range';

export interface ParticipantFilterState {
  studyName: string;
  phase: string;
  minParticipants: number | null;
  maxParticipants: number | null;
  minAvgAge: number | null;
  maxAvgAge: number | null;
  ageRangeFloor: number | null;    // row.min_age must be >= this
  ageRangeCeiling: number | null;  // row.max_age must be <= this
  minMale: number | null;
  maxMale: number | null;
  minFemale: number | null;
  maxFemale: number | null;
  siteContains: string;
  minAvgMeas: number | null;
  maxAvgMeas: number | null;
  minDate: string;   // ISO date "YYYY-MM-DD"; earliest_measurement must be on/after
  maxDate: string;   // ISO date "YYYY-MM-DD"; latest_measurement must be on/before
}

export const DEFAULT_PARTICIPANT_FILTERS: ParticipantFilterState = {
  studyName: '',
  phase: '',
  minParticipants: null,
  maxParticipants: null,
  minAvgAge: null,
  maxAvgAge: null,
  ageRangeFloor: null,
  ageRangeCeiling: null,
  minMale: null,
  maxMale: null,
  minFemale: null,
  maxFemale: null,
  siteContains: '',
  minAvgMeas: null,
  maxAvgMeas: null,
  minDate: '',
  maxDate: '',
};

export function formatPeriod(p: string): string {
  if (!p) return '';
  const d = new Date(p + 'T00:00:00');
  if (isNaN(d.getTime())) return p;
  const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${labels[d.getMonth()]} ${d.getDate()} '${String(d.getFullYear()).slice(2)}`;
}

export function formatDateRange(earliest: string, latest: string): string {
  if (!earliest || !latest) return '—';
  const fmt = (s: string) =>
    new Date(s).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  return `${fmt(earliest)} – ${fmt(latest)}`;
}

export function formatAgeRange(min: number, max: number): string {
  return `${min}–${max}`;
}

export function sortParticipantRows(
  rows: ParticipantSummary[],
  sortKey: ParticipantSortKey,
  sortDir: 'asc' | 'desc',
): ParticipantSummary[] {
  return [...rows].sort((a, b) => {
    let av: string | number = 0;
    let bv: string | number = 0;
    switch (sortKey) {
      case 'study_id':                         av = a.study_id;                           bv = b.study_id; break;
      case 'study_name':                       av = a.study_name;                         bv = b.study_name; break;
      case 'study_phase':                      av = a.study_phase;                        bv = b.study_phase; break;
      case 'participant_count':                av = a.participant_count;                  bv = b.participant_count; break;
      case 'avg_age':                          av = a.avg_age;                            bv = b.avg_age; break;
      case 'age_range':                        av = a.min_age;                            bv = b.min_age; break;
      case 'male_count':                       av = a.male_count;                         bv = b.male_count; break;
      case 'female_count':                     av = a.female_count;                       bv = b.female_count; break;
      case 'site_count':                       av = a.site_count;                         bv = b.site_count; break;
      case 'avg_measurements_per_participant': av = a.avg_measurements_per_participant;   bv = b.avg_measurements_per_participant; break;
      case 'date_range':                       av = a.earliest_measurement;               bv = b.earliest_measurement; break;
    }
    if (typeof av === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
    }
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });
}

export function filterParticipantRows(
  rows: ParticipantSummary[],
  filters: ParticipantFilterState,
): ParticipantSummary[] {
  return rows.filter(row => {
    if (filters.studyName) {
      const q = filters.studyName.toLowerCase();
      if (!row.study_name.toLowerCase().includes(q) && !row.study_id.toLowerCase().includes(q)) return false;
    }
    if (filters.phase) {
      if (!row.study_phase.toLowerCase().includes(filters.phase.toLowerCase())) return false;
    }
    if (filters.minParticipants !== null && row.participant_count < filters.minParticipants) return false;
    if (filters.maxParticipants !== null && row.participant_count > filters.maxParticipants) return false;
    if (filters.minAvgAge !== null && row.avg_age < filters.minAvgAge) return false;
    if (filters.maxAvgAge !== null && row.avg_age > filters.maxAvgAge) return false;
    if (filters.ageRangeFloor !== null && row.min_age < filters.ageRangeFloor) return false;
    if (filters.ageRangeCeiling !== null && row.max_age > filters.ageRangeCeiling) return false;
    if (filters.minMale !== null && row.male_count < filters.minMale) return false;
    if (filters.maxMale !== null && row.male_count > filters.maxMale) return false;
    if (filters.minFemale !== null && row.female_count < filters.minFemale) return false;
    if (filters.maxFemale !== null && row.female_count > filters.maxFemale) return false;
    if (filters.siteContains) {
      const q = filters.siteContains.toLowerCase();
      const hasMatch = row.sites.some(
        s => s.site_id.toLowerCase().includes(q) || s.site_name.toLowerCase().includes(q)
      );
      if (!hasMatch) return false;
    }
    if (filters.minAvgMeas !== null && row.avg_measurements_per_participant < filters.minAvgMeas) return false;
    if (filters.maxAvgMeas !== null && row.avg_measurements_per_participant > filters.maxAvgMeas) return false;
    const earliest = (row.earliest_measurement ?? '').substring(0, 10);
    const latest = (row.latest_measurement ?? '').substring(0, 10);
    if (filters.minDate && earliest < filters.minDate) return false;
    if (filters.maxDate && latest > filters.maxDate) return false;
    return true;
  });
}
