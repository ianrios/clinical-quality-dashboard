import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchJson } from './queries';

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
