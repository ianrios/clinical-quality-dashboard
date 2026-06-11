import type { StudyOverviewResponse, QualityDistributionResponse, ParticipantSummaryResponse, EnrollmentTrendResponse, ParticipantDetailResponse } from '../types';

export async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
  return r.json();
}

export const studiesOverviewQuery = {
  queryKey: ['studies', 'overview'] as const,
  queryFn: () => fetchJson<StudyOverviewResponse>('/api/studies/overview'),
};

export const qualityDistributionQuery = {
  queryKey: ['quality', 'distribution'] as const,
  queryFn: () => fetchJson<QualityDistributionResponse>('/api/quality/distribution'),
};

export function participantSummaryQuery(filters: { studyId?: string; siteId?: string }) {
  const clean: { studyId?: string; siteId?: string } = {};
  if (filters.studyId) clean.studyId = filters.studyId;
  if (filters.siteId) clean.siteId = filters.siteId;

  const params = new URLSearchParams();
  if (clean.studyId) params.set('study', clean.studyId);
  if (clean.siteId) params.set('site', clean.siteId);
  const qs = params.toString();

  return {
    queryKey: ['participants', 'summary', clean] as const,
    queryFn: () => fetchJson<ParticipantSummaryResponse>(`/api/participants/summary${qs ? `?${qs}` : ''}`),
  };
}

export function enrollmentTrendQuery(studyId?: string) {
  const params = new URLSearchParams();
  if (studyId) params.set('study', studyId);
  const qs = params.toString();
  return {
    queryKey: ['participants', 'enrollment', studyId ?? null] as const,
    queryFn: () => fetchJson<EnrollmentTrendResponse>(`/api/participants/enrollment${qs ? `?${qs}` : ''}`),
  };
}

export function participantListQuery(studyId: string, page: number, siteId?: string) {
  const limit = 25;
  const offset = (page - 1) * limit;
  const params = new URLSearchParams({ study: studyId, limit: String(limit), offset: String(offset) });
  if (siteId) params.set('site', siteId);
  return {
    queryKey: ['participants', 'list', studyId, page, siteId ?? null] as const,
    queryFn: () => fetchJson<ParticipantDetailResponse>(`/api/participants/list?${params}`),
  };
}
