import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { studiesListQuery, qualityDistributionQuery } from '../api/queries';
import { Skeleton } from './Skeleton';
import { TooltipHeader } from './TooltipHeader';
import {
  type BandId, type SortKey, type FilterState, type ViewState, type SavedView,
  ACTIVE_KEY, ACTIVE_NAME_KEY, VIEWS_KEY,
  DEFAULT_FILTERS, DEFAULT_VIEW,
  truncate, formatAvgQuality, computeMediumCount, filterRows, sortRows, computeZoomDomain,
  loadActiveView, loadActiveViewName, loadSavedViews, persistViews,
} from '../utils/dashboard';

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  showPercent: boolean;
  onShowPercentChange: (v: boolean) => void;
}

function QualityDashboard({ showPercent, onShowPercentChange }: Props) {
  const [initial] = useState(() => loadActiveView());

  const [horizontal, setHorizontal] = useState(initial.horizontal);
  const [hiddenBands, setHiddenBands] = useState<Set<BandId>>(new Set(initial.hiddenBands));
  const [zoomed, setZoomed] = useState(initial.zoomed);
  const [sortKey, setSortKey] = useState<SortKey>(initial.sortKey);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initial.sortDir);
  const [filters, setFilters] = useState<FilterState>(initial.filters);
  const [filtersLinked, setFiltersLinked] = useState(initial.filtersLinked);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>(loadSavedViews);
  const [activeViewName, setActiveViewName] = useState(() => loadActiveViewName());
  const [saveInputVisible, setSaveInputVisible] = useState(false);
  const [saveInputValue, setSaveInputValue] = useState('');

  useEffect(() => {
    try { localStorage.setItem(ACTIVE_NAME_KEY, activeViewName); } catch {}
  }, [activeViewName]);

  // Persist active state on every change
  useEffect(() => {
    const state: ViewState = {
      horizontal, hiddenBands: [...hiddenBands], zoomed,
      sortKey, sortDir, filters, filtersLinked, showPercent,
    };
    try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(state)); } catch {}
  }, [horizontal, hiddenBands, zoomed, sortKey, sortDir, filters, filtersLinked, showPercent]);

  // ─── Queries ───────────────────────────────────────────────────────────────

  const studiesQuery = useQuery(studiesListQuery);
  const qualityQuery = useQuery(qualityDistributionQuery);

  const studies = useMemo(() => studiesQuery.data?.data ?? [], [studiesQuery.data]);
  const qualityMap = useMemo(() => new Map(
    qualityQuery.data?.data.map(item => [item.study_id, item]) ?? []
  ), [qualityQuery.data]);

  // ─── Display keys ──────────────────────────────────────────────────────────

  const highKey = showPercent ? 'High Quality (≥90%)' : 'High Quality (≥0.9)';
  const mediumKey = showPercent ? 'Medium Quality (80–89%)' : 'Medium Quality (0.8–0.89)';
  const lowKey = showPercent ? 'Low Quality (<80%)' : 'Low Quality (<0.8)';

  // ─── Row data (all studies with computed medium) ───────────────────────────

  const allRows = useMemo(() => studies.map(study => {
    const quality = qualityMap.get(study.study_id);
    return { study, quality, mediumCount: computeMediumCount(quality) };
  }), [studies, qualityMap]);

  // ─── Filtering ─────────────────────────────────────────────────────────────

  const filteredRows = useMemo(() => filterRows(allRows, filters), [allRows, filters]);

  // ─── Sorting ───────────────────────────────────────────────────────────────

  const sortedRows = useMemo(() => sortRows(filteredRows, sortKey, sortDir), [filteredRows, sortKey, sortDir]);

  // Chart uses filtered or all rows depending on link state
  const chartRows = filtersLinked ? filteredRows : allRows;

  // ─── Chart data ────────────────────────────────────────────────────────────

  const chartData = useMemo(() => chartRows.map(({ study, quality, mediumCount }) => ({
    name: truncate(study.study_name),
    [highKey]: quality?.high_quality_count ?? 0,
    [mediumKey]: mediumCount ?? 0,
    [lowKey]: quality?.low_quality_count ?? 0,
  })), [chartRows, highKey, mediumKey, lowKey]);

  // ─── Zoom domain ───────────────────────────────────────────────────────────

  const visibleKeys = useMemo(() => [
    ...(!hiddenBands.has('high') ? [highKey] : []),
    ...(!hiddenBands.has('medium') ? [mediumKey] : []),
    ...(!hiddenBands.has('low') ? [lowKey] : []),
  ], [hiddenBands, highKey, mediumKey, lowKey]);

  const zoomDomain = useMemo(() => computeZoomDomain(chartData, visibleKeys), [chartData, visibleKeys]);

  const numberAxisProps = zoomed ? { domain: zoomDomain } : {};

  // ─── Legend ────────────────────────────────────────────────────────────────

  const legendItems: { id: BandId; label: string; color: string }[] = [
    { id: 'high', label: highKey, color: '#10b981' },
    { id: 'medium', label: mediumKey, color: '#f59e0b' },
    { id: 'low', label: lowKey, color: '#ef4444' },
  ];

  const renderLegend = () => (
    <div className="flex flex-col gap-3 pl-6">
      {legendItems.map(item => {
        const isHidden = hiddenBands.has(item.id);
        return (
          <div key={item.id} onClick={() => toggleBand(item.id)} className="flex items-center gap-2 cursor-pointer select-none">
            <div style={{ width: 12, height: 12, flexShrink: 0, backgroundColor: isHidden ? 'transparent' : item.color, border: `2px solid ${item.color}`, borderRadius: 2, transition: 'background-color 0.15s' }} />
            <span className="text-xs transition-colors" style={{ color: isHidden ? '#9ca3af' : '#374151' }}>{item.label}</span>
          </div>
        );
      })}
    </div>
  );

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const toggleBand = (band: BandId) => {
    setHiddenBands(prev => {
      const next = new Set(prev);
      if (next.has(band)) next.delete(band); else next.add(band);
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const setRangeFilter = (field: keyof Omit<FilterState, 'studyName'>, bound: 'min' | 'max', raw: string) => {
    const num = raw === '' ? null : parseFloat(raw);
    setFilters(prev => ({ ...prev, [field]: { ...(prev[field] as { min: number | null; max: number | null }), [bound]: num } }));
  };

  const getCurrentState = (): ViewState => ({
    horizontal, hiddenBands: [...hiddenBands], zoomed,
    sortKey, sortDir, filters, filtersLinked, showPercent,
  });

  const applyViewState = (state: ViewState) => {
    setHorizontal(state.horizontal);
    setHiddenBands(new Set(state.hiddenBands));
    setZoomed(state.zoomed);
    setSortKey(state.sortKey);
    setSortDir(state.sortDir);
    setFilters({ ...DEFAULT_FILTERS, ...state.filters });
    setFiltersLinked(state.filtersLinked);
    onShowPercentChange(state.showPercent);
  };

  const handleSelectView = (name: string) => {
    if (name === 'Default') { applyViewState(DEFAULT_VIEW); }
    else { const v = savedViews.find(v => v.name === name); if (v) applyViewState(v.state); }
    setActiveViewName(name);
  };

  const handleSaveView = () => {
    if (!saveInputValue.trim()) return;
    const name = saveInputValue.trim();
    const updated = [...savedViews.filter(v => v.name !== name), { name, state: getCurrentState() }];
    setSavedViews(updated);
    persistViews(updated);
    setSaveInputValue('');
    setSaveInputVisible(false);
    setActiveViewName(name);
  };

  const handleDeleteView = (name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const updated = savedViews.filter(v => v.name !== name);
    setSavedViews(updated);
    persistViews(updated);
    setActiveViewName('Default');
    applyViewState(DEFAULT_VIEW);
  };

  // ─── Tooltip strings ───────────────────────────────────────────────────────

  const avgQualityTooltip = showPercent
    ? 'Mean quality score as a percentage. ≥90% = High, 80–89% = Medium, <80% = Low'
    : 'Mean quality score. Scale: 0–1. ≥0.9 = High, 0.8–0.89 = Medium, <0.8 = Low';
  const highQualityTooltip = showPercent
    ? 'Count of measurements scoring ≥90% — meets the threshold for primary analysis'
    : 'Count of measurements scoring ≥0.9 — meets the threshold for primary analysis';
  const mediumQualityTooltip = showPercent
    ? 'Count of measurements scoring 80–89% — acceptable quality, may be included with caveats'
    : 'Count of measurements scoring 0.8–0.89 — acceptable quality, may be included with caveats';
  const lowQualityTooltip = showPercent
    ? 'Count of measurements scoring <80% — may require review or exclusion'
    : 'Count of measurements scoring <0.8 — may require review or exclusion';

  // ─── Shared bar props ──────────────────────────────────────────────────────

  const sortedSavedViews = useMemo(() => [...savedViews].sort((a, b) => a.name.localeCompare(b.name)), [savedViews]);

  const btnBase = 'text-xs border rounded px-2 py-1 transition-colors';
  const btnActive = (color: string) => `${btnBase} ${color}`;
  const btnInactive = `${btnBase} text-gray-500 hover:text-gray-700 border-gray-200 hover:border-gray-300`;

  // ─── Shared chart bars ─────────────────────────────────────────────────────

  const sharedBars = (
    <>
      <Bar dataKey={highKey} fill="#10b981" hide={hiddenBands.has('high')} />
      <Bar dataKey={mediumKey} fill="#f59e0b" hide={hiddenBands.has('medium')} />
      <Bar dataKey={lowKey} fill="#ef4444" hide={hiddenBands.has('low')} />
    </>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">

        {/* ── Views toolbar ── */}
        <div className="flex items-center gap-2 flex-wrap mb-6 pb-4 border-b border-gray-100">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mr-1">Views</span>
          <select
            value={activeViewName}
            onChange={e => handleSelectView(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700"
          >
            <option value="Default">Default</option>
            {sortedSavedViews.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
          </select>
          {activeViewName !== 'Default' && (
            <button onClick={() => handleDeleteView(activeViewName)} className={`${btnBase} text-red-500 hover:text-red-700 border-red-200 hover:border-red-400`}>
              Delete
            </button>
          )}
          <div className="w-px h-4 bg-gray-200" />
          {saveInputVisible ? (
            <div className="flex items-center gap-1">
              <input
                type="text" value={saveInputValue} onChange={e => setSaveInputValue(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleSaveView(); if (e.key === 'Escape') { setSaveInputVisible(false); setSaveInputValue(''); } }}
                placeholder="View name"
                className="text-xs border border-gray-200 rounded px-2 py-1 w-32 focus:outline-none focus:border-blue-400"
              />
              <button onClick={handleSaveView} className={btnActive('bg-blue-600 text-white border-blue-600')}>Save</button>
              <button onClick={() => { setSaveInputVisible(false); setSaveInputValue(''); }} className={btnInactive}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setSaveInputVisible(true)} className={btnInactive}>Save current view</button>
          )}
          <button onClick={() => { applyViewState(DEFAULT_VIEW); setActiveViewName('Default'); }} className={btnInactive}>
            Reset to Default
          </button>
        </div>

        {/* ── Title ── */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Quality Score Distribution by Study</h2>
          <p className="mt-1 text-sm text-gray-500">Overview of data quality across all clinical studies</p>
        </div>

        {/* ── Chart section ── */}
        <div className="mb-2">
          {qualityQuery.isPending ? (
            <div className="flex flex-col items-center justify-center h-[400px] bg-gray-50 rounded-lg border border-gray-200">
              <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" />
              <p className="mt-3 text-sm text-gray-500">Loading chart data...</p>
            </div>
          ) : qualityQuery.isError ? (
            <div className="flex items-center justify-center h-[400px] bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-red-600">Failed to load chart data</p>
            </div>
          ) : (
            <>
              {/* Controls row */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setZoomed(p => !p)}
                  className={zoomed ? btnActive('bg-violet-600 text-white border-violet-600') : btnInactive}
                >
                  Zoom
                </button>
                <button onClick={() => setHorizontal(p => !p)} className={btnInactive}>
                  {horizontal ? 'Vertical view' : 'Horizontal view'}
                </button>
              </div>

              {/* Chart */}
              <ResponsiveContainer width="100%" height={400}>
                {horizontal ? (
                  <BarChart layout="vertical" data={chartData} margin={{ right: 240, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v: number) => v.toLocaleString()} {...numberAxisProps} />
                    <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => v.toLocaleString()} />
                    <Legend layout="vertical" align="right" verticalAlign="middle" content={renderLegend} />
                    {sharedBars}
                  </BarChart>
                ) : (
                  <BarChart data={chartData} margin={{ right: 240 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={120} />
                    <YAxis tickFormatter={(v: number) => v.toLocaleString()} {...numberAxisProps} />
                    <Tooltip formatter={(v: number) => v.toLocaleString()} />
                    <Legend layout="vertical" align="right" verticalAlign="middle" content={renderLegend} />
                    {sharedBars}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </>
          )}
        </div>

        {/* ── Link / Unlink ── */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-gray-100" />
          <button
            onClick={() => setFiltersLinked(p => !p)}
            className={`text-xs border rounded px-3 py-1 transition-colors ${
              filtersLinked
                ? 'border-blue-300 text-blue-600 bg-blue-50 hover:bg-blue-100'
                : 'border-dashed border-gray-300 text-gray-500 hover:text-gray-700'
            }`}
          >
            {filtersLinked ? 'Chart linked to filters' : 'Chart unlinked from filters'}
          </button>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/* ── Table section ── */}
        <div className="border-t border-gray-200 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Study Details</h3>
            <button
              onClick={() => setFiltersOpen(p => !p)}
              className={`${btnBase} ${filtersOpen ? 'bg-gray-100 border-gray-300 text-gray-700' : btnInactive}`}
            >
              {filtersOpen ? 'Hide Filters' : 'Filters'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    { key: 'study_name' as SortKey, label: 'Study', tooltip: 'The clinical study name and ID', align: 'left' as const },
                    { key: 'total_measurements' as SortKey, label: 'Total Measurements', tooltip: 'Total number of data measurements recorded across all participants and sites in this study' },
                    { key: 'avg_quality_score' as SortKey, label: 'Avg Quality', tooltip: avgQualityTooltip },
                    { key: 'high_quality_count' as SortKey, label: 'High Quality', tooltip: highQualityTooltip },
                    { key: 'medium_quality_count' as SortKey, label: 'Med Quality', tooltip: mediumQualityTooltip },
                    { key: 'low_quality_count' as SortKey, label: 'Low Quality', tooltip: lowQualityTooltip },
                  ].map(col => (
                    <th key={col.key} className={`px-6 py-3 ${col.align === 'left' ? 'text-left' : 'text-right'} text-xs font-medium text-gray-500 uppercase tracking-wider`}>
                      <TooltipHeader
                        label={col.label} tooltip={col.tooltip} align={col.align ?? 'right'}
                        onSort={() => handleSort(col.key)}
                        isSorted={sortKey === col.key}
                        sortDir={sortDir}
                      />
                    </th>
                  ))}
                </tr>

                {/* Filter row */}
                {filtersOpen && (
                  <tr className="bg-white border-t border-gray-100">
                    <td className="px-6 py-2">
                      <input type="text" value={filters.studyName}
                        onChange={e => setFilters(p => ({ ...p, studyName: e.target.value }))}
                        placeholder="Search name or ID…"
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-300"
                      />
                    </td>
                    {([
                      { field: 'totalMeasurements', step: '1', placeholder: '0' },
                      { field: 'avgQualityScore', step: '0.01', placeholder: '0.0' },
                      { field: 'highQuality', step: '1', placeholder: '0' },
                      { field: 'mediumQuality', step: '1', placeholder: '0' },
                      { field: 'lowQuality', step: '1', placeholder: '0' },
                    ] as const).map(({ field, step }) => (
                      <td key={field} className="px-6 py-2">
                        <div className="flex gap-1 justify-end">
                          <input type="number" step={step} placeholder={`Min`}
                            value={(filters[field] as { min: number | null; max: number | null }).min ?? ''}
                            onChange={e => setRangeFilter(field, 'min', e.target.value)}
                            className="w-16 text-xs border border-gray-200 rounded px-1 py-1 text-right focus:outline-none focus:border-blue-300"
                          />
                          <input type="number" step={step} placeholder={`Max`}
                            value={(filters[field] as { min: number | null; max: number | null }).max ?? ''}
                            onChange={e => setRangeFilter(field, 'max', e.target.value)}
                            className="w-16 text-xs border border-gray-200 rounded px-1 py-1 text-right focus:outline-none focus:border-blue-300"
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                )}
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {studiesQuery.isPending ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4"><Skeleton width="w-40" className="mb-1" /><Skeleton width="w-20" height="h-3" /></td>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-6 py-4 text-right"><Skeleton className="ml-auto" /></td>
                      ))}
                    </tr>
                  ))
                ) : (
                  sortedRows.map(({ study, quality, mediumCount }) => (
                    <tr key={study.study_id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{study.study_name}</div>
                        <div className="text-sm text-gray-500">{study.study_id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {quality ? quality.total_measurements.toLocaleString() : <Skeleton className="ml-auto" />}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {quality ? (
                          <span className={`text-sm font-medium ${
                            quality.avg_quality_score >= 0.9 ? 'text-green-600'
                            : quality.avg_quality_score >= 0.8 ? 'text-yellow-600'
                            : 'text-red-600'
                          }`}>{formatAvgQuality(quality.avg_quality_score, showPercent)}</span>
                        ) : <Skeleton className="ml-auto" />}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {quality ? quality.high_quality_count.toLocaleString() : <Skeleton className="ml-auto" />}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {mediumCount !== null ? mediumCount.toLocaleString() : <Skeleton className="ml-auto" />}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {quality ? quality.low_quality_count.toLocaleString() : <Skeleton className="ml-auto" />}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

export default QualityDashboard;
