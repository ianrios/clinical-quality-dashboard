import type { StudyListResponse, StudyOverviewResponse, QualityDistributionResponse } from '../types';

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
  return r.json();
}

export const studiesListQuery = {
  queryKey: ['studies', 'list'] as const,
  queryFn: () => fetchJson<StudyListResponse>('/api/studies/list'),
};

export const studiesOverviewQuery = {
  queryKey: ['studies', 'overview'] as const,
  queryFn: () => fetchJson<StudyOverviewResponse>('/api/studies/overview'),
};

export const qualityDistributionQuery = {
  queryKey: ['quality', 'distribution'] as const,
  queryFn: () => fetchJson<QualityDistributionResponse>('/api/quality/distribution'),
};
