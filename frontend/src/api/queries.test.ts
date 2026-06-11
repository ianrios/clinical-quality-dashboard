import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchJson, participantSummaryQuery, enrollmentTrendQuery, participantListQuery } from './queries';

describe('fetchJson', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns parsed JSON on a successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [1, 2, 3] }),
    }));
    const result = await fetchJson<{ data: number[] }>('/api/test');
    expect(result).toEqual({ data: [1, 2, 3] });
  });

  it('calls fetch with the given URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', mockFetch);
    await fetchJson('/api/studies/list');
    expect(mockFetch).toHaveBeenCalledWith('/api/studies/list');
  });

  it('throws with the status code on a 4xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(fetchJson('/api/missing')).rejects.toThrow('HTTP error! status: 404');
  });

  it('throws with the status code on a 5xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(fetchJson('/api/broken')).rejects.toThrow('HTTP error! status: 500');
  });

  it('propagates a network-level error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    await expect(fetchJson('/api/any')).rejects.toThrow('Network error');
  });
});

// ─── participantSummaryQuery ──────────────────────────────────────────────────

describe('participantSummaryQuery', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('produces the unfiltered query key for empty filters', () => {
    const q = participantSummaryQuery({});
    expect(q.queryKey).toEqual(['participants', 'summary', {}]);
  });

  it('produces a query key with studyId only when studyId is provided', () => {
    const q = participantSummaryQuery({ studyId: 'CARDIO001' });
    expect(q.queryKey).toEqual(['participants', 'summary', { studyId: 'CARDIO001' }]);
  });

  it('produces a query key with both filters when both are provided', () => {
    const q = participantSummaryQuery({ studyId: 'CARDIO001', siteId: 'SITE_NY01' });
    expect(q.queryKey).toEqual(['participants', 'summary', { studyId: 'CARDIO001', siteId: 'SITE_NY01' }]);
  });

  it('excludes undefined keys from the query key object', () => {
    const q = participantSummaryQuery({ studyId: undefined, siteId: undefined });
    expect(q.queryKey[2]).toEqual({});
  });

  it('calls /api/participants/summary with no params when unfiltered', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [] }) });
    vi.stubGlobal('fetch', mockFetch);
    await participantSummaryQuery({}).queryFn();
    expect(mockFetch).toHaveBeenCalledWith('/api/participants/summary');
  });

  it('appends study param to the URL when studyId is provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [] }) });
    vi.stubGlobal('fetch', mockFetch);
    await participantSummaryQuery({ studyId: 'CARDIO001' }).queryFn();
    expect(mockFetch).toHaveBeenCalledWith('/api/participants/summary?study=CARDIO001');
  });

  it('appends both study and site params when both are provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [] }) });
    vi.stubGlobal('fetch', mockFetch);
    await participantSummaryQuery({ studyId: 'CARDIO001', siteId: 'SITE_NY01' }).queryFn();
    expect(mockFetch).toHaveBeenCalledWith('/api/participants/summary?study=CARDIO001&site=SITE_NY01');
  });
});

// ─── enrollmentTrendQuery ─────────────────────────────────────────────────────

describe('enrollmentTrendQuery', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });

  it('produces unfiltered query key when no studyId given', () => {
    expect(enrollmentTrendQuery().queryKey).toEqual(['participants', 'enrollment', null]);
  });

  it('produces filtered query key when studyId given', () => {
    expect(enrollmentTrendQuery('CARDIO001').queryKey).toEqual(['participants', 'enrollment', 'CARDIO001']);
  });

  it('calls /api/participants/enrollment with no params when unfiltered', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [{ study_id: 'S1', period: '2022-01-15', count: 5 }] }) });
    vi.stubGlobal('fetch', mockFetch);
    await enrollmentTrendQuery().queryFn();
    expect(mockFetch).toHaveBeenCalledWith('/api/participants/enrollment');
  });

  it('appends study param when studyId given', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [] }) });
    vi.stubGlobal('fetch', mockFetch);
    await enrollmentTrendQuery('CARDIO001').queryFn();
    expect(mockFetch).toHaveBeenCalledWith('/api/participants/enrollment?study=CARDIO001');
  });
});

// ─── participantListQuery ─────────────────────────────────────────────────────

describe('participantListQuery', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });

  it('produces a stable query key with all params', () => {
    expect(participantListQuery('CARDIO001', 1).queryKey).toEqual(['participants', 'list', 'CARDIO001', 1, null]);
  });

  it('includes siteId in query key when provided', () => {
    expect(participantListQuery('CARDIO001', 2, 'SITE_NY01').queryKey).toEqual(['participants', 'list', 'CARDIO001', 2, 'SITE_NY01']);
  });

  it('calls the correct URL for page 1 with no site', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [], total: 0 }) });
    vi.stubGlobal('fetch', mockFetch);
    await participantListQuery('CARDIO001', 1).queryFn();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('study=CARDIO001');
    expect(url).toContain('offset=0');
    expect(url).toContain('limit=25');
  });

  it('computes correct offset for page 3', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [], total: 0 }) });
    vi.stubGlobal('fetch', mockFetch);
    await participantListQuery('CARDIO001', 3).queryFn();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('offset=50');
  });
});
