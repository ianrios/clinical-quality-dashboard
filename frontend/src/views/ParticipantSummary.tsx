import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import type { ParticipantSummary as PS } from '../types';
import {
  studiesOverviewQuery, participantSummaryQuery,
  enrollmentTrendQuery, participantListQuery,
} from '../api/queries';
import { Skeleton } from '../components/Skeleton';
import { TooltipHeader } from '../components/TooltipHeader';
import { useSort, BTN_BASE, BTN_INACTIVE } from '../utils/ui';
import {
  type ParticipantSortKey, type ParticipantFilterState,
  DEFAULT_PARTICIPANT_FILTERS,
  formatDateRange, formatAgeRange, formatPeriod,
  sortParticipantRows, filterParticipantRows,
} from '../utils/participants';

// ─── Constants ────────────────────────────────────────────────────────────────

const STUDY_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const STICKY_CTRL_CLASS = 'sticky left-0 z-10 border-r-2 border-gray-300';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function NumInput({ value, onChange, placeholder = '' }: { value: number | null; onChange: (v: number | null) => void; placeholder?: string }) {
  return (
    <input
      type="number"
      placeholder={placeholder}
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
      className="w-14 text-xs border border-gray-200 rounded px-1 py-1 text-right focus:outline-none focus:border-blue-300"
    />
  );
}

function TextInput({ value, onChange, placeholder = '', className = '' }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-300 ${className}`}
    />
  );
}

// ─── Compare panel ────────────────────────────────────────────────────────────

function ComparePanel({ a, b, onClear }: { a: PS; b: PS; onClear: () => void }) {
  const genderStr = (count: number, total: number) =>
    `${count.toLocaleString()} (${total > 0 ? ((count / total) * 100).toFixed(0) : 0}%)`;

  const rows: [string, string, string][] = [
    ['Study ID',       a.study_id,       b.study_id],
    ['Phase',          a.study_phase,    b.study_phase],
    ['Participants',   a.participant_count.toLocaleString(), b.participant_count.toLocaleString()],
    ['Avg Age',        a.avg_age.toFixed(1), b.avg_age.toFixed(1)],
    ['Age Range',      formatAgeRange(a.min_age, a.max_age), formatAgeRange(b.min_age, b.max_age)],
    ['Male',           genderStr(a.male_count, a.male_count + a.female_count), genderStr(b.male_count, b.male_count + b.female_count)],
    ['Female',         genderStr(a.female_count, a.male_count + a.female_count), genderStr(b.female_count, b.male_count + b.female_count)],
    ['Sites',          String(a.site_count), String(b.site_count)],
    ['Avg Meas/Pt',    a.avg_measurements_per_participant.toFixed(1), b.avg_measurements_per_participant.toFixed(1)],
    ['Date Range',     formatDateRange(a.earliest_measurement, a.latest_measurement), formatDateRange(b.earliest_measurement, b.latest_measurement)],
  ];

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-blue-900">Study Comparison</h3>
        <button onClick={onClear} className="text-xs text-blue-600 hover:text-blue-800 border border-blue-300 hover:border-blue-500 rounded px-2 py-0.5 transition-colors">× Clear</button>
      </div>
      <div className="overflow-x-auto">
        <table className="text-sm w-full">
          <thead>
            <tr className="border-b border-blue-200">
              <th className="text-left text-xs font-medium text-blue-700 uppercase pr-8 pb-2 w-36">Metric</th>
              <th className="text-left text-xs font-medium text-blue-900 pb-2 pr-8">{a.study_name}</th>
              <th className="text-left text-xs font-medium text-blue-900 pb-2">{b.study_name}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, valA, valB]) => (
              <tr key={label} className="border-b border-blue-100 last:border-0">
                <td className="text-xs text-blue-700 font-medium py-1.5 pr-8">{label}</td>
                <td className="text-sm text-gray-900 py-1.5 pr-8">{valA}</td>
                <td className="text-sm text-gray-900 py-1.5">{valB}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Enrollment chart ─────────────────────────────────────────────────────────

function EnrollmentChart({ studyIds, studyNames, filterStudyId }: {
  studyIds: string[];
  studyNames: Record<string, string>;
  filterStudyId?: string;
}) {
  const result = useQuery(enrollmentTrendQuery(filterStudyId));

  const { chartData, activeStudyIds } = useMemo(() => {
    const raw = result.data?.data ?? [];
    const active = filterStudyId ? [filterStudyId] : studyIds;
    const lookup = new Map(raw.map(d => [`${d.study_id}|${d.period}`, d.count]));
    const periods = [...new Set(raw.map(d => d.period))].sort();
    const data = periods.map(period => {
      const row: Record<string, string | number | null> = { period };
      for (const sid of active) row[sid] = lookup.get(`${sid}|${period}`) ?? null;
      return row;
    });
    return { chartData: data, activeStudyIds: active };
  }, [result.data, studyIds, filterStudyId]);

  if (result.isPending) {
    return <div className="h-48 flex items-center justify-center"><div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" /></div>;
  }
  if (result.isError || chartData.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 5, right: 24, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="period"
          tickFormatter={formatPeriod}
          tick={{ fontSize: 10 }}
          interval={Math.max(0, Math.floor(chartData.length / 10) - 1)}
        />
        <YAxis tick={{ fontSize: 11 }} width={36} />
        <Tooltip labelFormatter={formatPeriod} formatter={(val: number) => [val, '']} />
        <Legend formatter={sid => studyNames[sid as string] ?? sid} wrapperStyle={{ fontSize: 11 }} />
        {activeStudyIds.map(sid => (
          <Line
            key={sid}
            type="monotone"
            dataKey={sid}
            stroke={STUDY_COLORS[studyIds.indexOf(sid) % STUDY_COLORS.length]}
            dot={false}
            connectNulls={false}
            strokeWidth={2}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Drilldown panel ──────────────────────────────────────────────────────────

function DrilldownPanel({ studyId, studyName, siteId, page, onPageChange, onClose }: {
  studyId: string;
  studyName: string;
  siteId?: string;
  page: number;
  onPageChange: (p: number) => void;
  onClose: () => void;
}) {
  const result = useQuery(participantListQuery(studyId, page, siteId));
  const perPage = 25;
  const total = result.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  return (
    <div className="px-6 py-4 bg-indigo-50/60">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-sm font-semibold text-indigo-900">Individual Participants — {studyName}</span>
          {!result.isPending && <span className="ml-2 text-xs text-indigo-600">{total.toLocaleString()} total</span>}
        </div>
        <button onClick={onClose} className="text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-300 rounded px-2 py-0.5 transition-colors">× Close</button>
      </div>

      {result.isError ? (
        <p className="text-sm text-red-600">Failed to load participants</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded border border-indigo-100 bg-white">
            <table className="min-w-full text-sm divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Participant ID', 'Gender', 'Age', 'Site', 'Measurements'].map(h => (
                    <th key={h} className={`px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider ${h === 'Participant ID' || h === 'Site' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {result.isPending
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2"><Skeleton width="w-24" /></td>
                        <td className="px-4 py-2"><Skeleton className="ml-auto" width="w-12" /></td>
                        <td className="px-4 py-2"><Skeleton className="ml-auto" width="w-8" /></td>
                        <td className="px-4 py-2"><Skeleton width="w-32" /></td>
                        <td className="px-4 py-2"><Skeleton className="ml-auto" width="w-12" /></td>
                      </tr>
                    ))
                  : (result.data?.data ?? []).map(pt => (
                      <tr key={pt.participant_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-left font-mono text-xs text-gray-700">{pt.participant_id}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{pt.participant_gender}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{pt.age}</td>
                        <td className="px-4 py-2 text-left text-gray-600 text-xs">{pt.site_name}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{pt.measurement_count.toLocaleString()}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-indigo-600">{result.isPending ? '…' : `${start}–${end} of ${total.toLocaleString()}`}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="text-xs px-3 py-1 border border-indigo-200 rounded disabled:opacity-40 hover:bg-indigo-50 transition-colors">← Prev</button>
                <span className="text-xs text-indigo-600 px-2 py-1">{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="text-xs px-3 py-1 border border-indigo-200 rounded disabled:opacity-40 hover:bg-indigo-50 transition-colors">Next →</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function ParticipantSummary() {
  const [searchParams, setSearchParams] = useSearchParams();
  const studyId = searchParams.get('study') ?? undefined;
  const siteId = searchParams.get('site') ?? undefined;

  const queryClient = useQueryClient();
  const summaryResult = useQuery(participantSummaryQuery({ studyId, siteId }));
  const studiesListResult = useQuery(studiesOverviewQuery);

  useEffect(() => {
    if (studyId || siteId) queryClient.prefetchQuery(participantSummaryQuery({}));
  }, [studyId, siteId, queryClient]);

  const rows = useMemo(() => summaryResult.data?.data ?? [], [summaryResult.data]);
  const studiesList = studiesListResult.data?.data ?? [];

  const studyNames = useMemo(() =>
    Object.fromEntries(studiesList.map(s => [s.study_id, s.study_name])),
  [studiesList]);
  const allStudyIds = useMemo(() => studiesList.map(s => s.study_id), [studiesList]);

  // Accordion
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = searchParams.get('study');
    return s ? new Set([s]) : new Set();
  });
  const toggleExpanded = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // Compare
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const toggleCompare = (id: string) => setSelectedForCompare(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= 2 ? prev : [...prev, id]
  );

  // Drilldown — page state lifted so it persists across close/reopen
  const [drilldownStudyId, setDrilldownStudyId] = useState<string | null>(null);
  const [drilldownPages, setDrilldownPages] = useState<Map<string, number>>(new Map());
  const toggleDrilldown = (id: string) => setDrilldownStudyId(prev => prev === id ? null : id);
  const getDrilldownPage = (id: string) => drilldownPages.get(id) ?? 1;
  const setDrilldownPage = (id: string, page: number) =>
    setDrilldownPages(prev => new Map(prev).set(id, page));

  // Sort
  const { sortKey, sortDir, handleSort } = useSort<ParticipantSortKey>('study_id', 'asc');

  // Filters
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<ParticipantFilterState>(DEFAULT_PARTICIPANT_FILTERS);
  const setF = <K extends keyof ParticipantFilterState>(k: K, v: ParticipantFilterState[K]) =>
    setFilters(prev => ({ ...prev, [k]: v }));

  const availableSites = useMemo(() => {
    if (!studyId || !rows.length) return [];
    return (rows.find(r => r.study_id === studyId)?.sites ?? [])
      .slice().sort((a, b) => a.site_name.localeCompare(b.site_name));
  }, [rows, studyId]);

  const filteredRows = useMemo(() => filterParticipantRows(rows, filters), [rows, filters]);
  const sortedRows = useMemo(() => sortParticipantRows(filteredRows, sortKey, sortDir), [filteredRows, sortKey, sortDir]);

  useEffect(() => {
    if (filters.siteContains && filteredRows.length > 0) {
      setExpanded(prev => new Set([...prev, ...filteredRows.map(r => r.study_id)]));
    }
  }, [filters.siteContains, filteredRows]);

  // KPI — derived from filteredRows so it reflects client-side filters
  const kpi = useMemo(() => {
    if (!filteredRows.length) return null;
    const total = filteredRows.reduce((s, r) => s + r.participant_count, 0);
    const earliest = filteredRows.map(r => r.earliest_measurement).filter(Boolean).sort()[0];
    const latest = filteredRows.map(r => r.latest_measurement).filter(Boolean).sort().reverse()[0];
    const totalMale = filteredRows.reduce((s, r) => s + r.male_count, 0);
    const totalFemale = filteredRows.reduce((s, r) => s + r.female_count, 0);
    const totalGender = totalMale + totalFemale;
    const weightedAge = filteredRows.reduce((s, r) => s + r.avg_age * r.participant_count, 0);
    return {
      total,
      dateRange: formatDateRange(earliest, latest),
      avgAge: total > 0 ? weightedAge / total : 0,
      malePct: totalGender > 0 ? (totalMale / totalGender) * 100 : 0,
      femalePct: totalGender > 0 ? (totalFemale / totalGender) * 100 : 0,
    };
  }, [filteredRows]);

  const compareA = selectedForCompare[0] ? rows.find(r => r.study_id === selectedForCompare[0]) : undefined;
  const compareB = selectedForCompare[1] ? rows.find(r => r.study_id === selectedForCompare[1]) : undefined;

  const cols: { key: ParticipantSortKey; label: string; tooltip: string; align?: 'left' }[] = [
    { key: 'study_name',                       label: 'Study',       tooltip: 'Study name — click to view individual participants', align: 'left' },
    { key: 'study_phase',                      label: 'Phase',       tooltip: 'Clinical trial phase' },
    { key: 'participant_count',                label: 'Participants',tooltip: 'Total unique participants enrolled' },
    { key: 'avg_age',                          label: 'Avg Age',     tooltip: 'Mean participant age in years' },
    { key: 'age_range',                        label: 'Age Range',   tooltip: 'Youngest to oldest participant (years)' },
    { key: 'male_count',                       label: 'Male',        tooltip: 'Count of male participants' },
    { key: 'female_count',                     label: 'Female',      tooltip: 'Count of female participants' },
    { key: 'site_count',                       label: 'Sites',       tooltip: 'Number of distinct sites — expand row for per-site breakdown' },
    { key: 'avg_measurements_per_participant', label: 'Avg Meas/Pt', tooltip: 'Average measurements per participant' },
    { key: 'date_range',                       label: 'Date Range',  tooltip: 'Earliest to latest measurement date' },
  ];

  return (
    <div className="space-y-6">

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Participants', content: summaryResult.isPending ? null : kpi?.total.toLocaleString() ?? '—', size: 'text-2xl' },
          { label: 'Date Range',         content: summaryResult.isPending ? null : kpi?.dateRange ?? '—', size: 'text-base' },
          { label: 'Average Age',        content: summaryResult.isPending ? null : kpi?.avgAge.toFixed(1) ?? '—', size: 'text-2xl' },
          { label: 'Gender Split',       content: summaryResult.isPending ? null : kpi ? `${kpi.malePct.toFixed(0)}% M / ${kpi.femalePct.toFixed(0)}% F` : '—', size: 'text-lg' },
        ].map(({ label, content, size }) => (
          <div key={label} className="bg-white shadow rounded-lg p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</div>
            {content === null ? <Skeleton width="w-24" height="h-8" /> : <div className={`${size} font-bold text-gray-900`}>{content}</div>}
          </div>
        ))}
      </div>

      {/* Main table card */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Participant Summary</h2>
          <p className="mt-1 text-sm text-gray-500">Demographic and enrollment composition by study — click a study name to drill down to individual participants</p>
        </div>

        {/* Study / Site selectors */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Study:</label>
            <select
              value={studyId ?? ''}
              onChange={e => {
                const val = e.target.value;
                setSearchParams(val
                  ? p => { p.set('study', val); p.delete('site'); return p; }
                  : p => { p.delete('study'); p.delete('site'); return p; });
              }}
              className="text-sm border border-gray-200 rounded px-2 py-1 bg-white text-gray-700"
            >
              <option value="">All Studies</option>
              {studiesList.map(s => <option key={s.study_id} value={s.study_id}>{s.study_name}</option>)}
            </select>
          </div>
          {studyId && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Site:</label>
              <select
                value={siteId ?? ''}
                onChange={e => {
                  const val = e.target.value;
                  setSearchParams(val
                    ? p => { p.set('site', val); return p; }
                    : p => { p.delete('site'); return p; });
                }}
                className="text-sm border border-gray-200 rounded px-2 py-1 bg-white text-gray-700"
              >
                <option value="">All Sites</option>
                {availableSites.map(s => <option key={s.site_id} value={s.site_id}>{s.site_name}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Compare hint */}
        {selectedForCompare.length === 1 && (
          <div className="flex items-center gap-2 mb-3 text-xs text-blue-600">
            <span>1 study selected — pick 1 more to compare</span>
            <button onClick={() => setSelectedForCompare([])} className="text-blue-400 hover:text-blue-600">× clear</button>
          </div>
        )}

        {/* Comparison panel */}
        {compareA && compareB && (
          <ComparePanel a={compareA} b={compareB} onClear={() => setSelectedForCompare([])} />
        )}

        {/* Table controls */}
        <div className="flex items-center justify-between mb-3 border-t border-gray-100 pt-4">
          <h3 className="text-lg font-medium text-gray-900">
            Studies
            {selectedForCompare.length > 0 && (
              <span className="ml-2 text-xs text-blue-600 font-normal">
                ({selectedForCompare.length} selected for comparison)
              </span>
            )}
          </h3>
          <button
            onClick={() => setFiltersOpen(p => !p)}
            className={`${BTN_BASE} ${filtersOpen ? 'bg-gray-100 border-gray-300 text-gray-700' : BTN_INACTIVE}`}
          >
            {filtersOpen ? 'Hide Filters' : 'Filters'}
          </button>
        </div>

        {summaryResult.isError ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-700">Failed to load participant summary</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className={`${STICKY_CTRL_CLASS} bg-gray-50 px-3 py-3 w-20 text-xs font-medium text-gray-500 uppercase text-center`}>
                    <span title="Select up to 2 studies to compare">⊞</span>
                  </th>
                  {cols.map(col => (
                    <th
                      key={col.key}
                      className={`px-6 py-3 ${col.align === 'left' ? 'text-left' : 'text-right'} text-xs font-medium text-gray-500 uppercase tracking-wider`}
                    >
                      <TooltipHeader
                        label={col.label} tooltip={col.tooltip} align={col.align ?? 'right'}
                        onSort={() => handleSort(col.key)}
                        isSorted={sortKey === col.key} sortDir={sortDir}
                      />
                    </th>
                  ))}
                </tr>

                {filtersOpen && (
                  <tr className="bg-white border-t border-gray-100">
                    <td className={`${STICKY_CTRL_CLASS} bg-white px-3 py-2`} />
                    <td className="px-6 py-2"><TextInput value={filters.studyName} onChange={v => setF('studyName', v)} placeholder="Search…" className="w-full" /></td>
                    <td className="px-6 py-2"><TextInput value={filters.phase} onChange={v => setF('phase', v)} placeholder="Phase…" className="w-full" /></td>
                    <td className="px-6 py-2"><div className="flex gap-1 justify-end"><NumInput value={filters.minParticipants} onChange={v => setF('minParticipants', v)} placeholder="Min" /><NumInput value={filters.maxParticipants} onChange={v => setF('maxParticipants', v)} placeholder="Max" /></div></td>
                    <td className="px-6 py-2"><div className="flex gap-1 justify-end"><NumInput value={filters.minAvgAge} onChange={v => setF('minAvgAge', v)} placeholder="Min" /><NumInput value={filters.maxAvgAge} onChange={v => setF('maxAvgAge', v)} placeholder="Max" /></div></td>
                    <td className="px-6 py-2"><div className="flex gap-1 justify-end"><NumInput value={filters.ageRangeFloor} onChange={v => setF('ageRangeFloor', v)} placeholder="Min" /><NumInput value={filters.ageRangeCeiling} onChange={v => setF('ageRangeCeiling', v)} placeholder="Max" /></div></td>
                    <td className="px-6 py-2"><div className="flex gap-1 justify-end"><NumInput value={filters.minMale} onChange={v => setF('minMale', v)} placeholder="Min" /><NumInput value={filters.maxMale} onChange={v => setF('maxMale', v)} placeholder="Max" /></div></td>
                    <td className="px-6 py-2"><div className="flex gap-1 justify-end"><NumInput value={filters.minFemale} onChange={v => setF('minFemale', v)} placeholder="Min" /><NumInput value={filters.maxFemale} onChange={v => setF('maxFemale', v)} placeholder="Max" /></div></td>
                    <td className="px-6 py-2">
                      <div className="text-xs text-gray-400 mb-0.5">has site:</div>
                      <TextInput value={filters.siteContains} onChange={v => setF('siteContains', v)} placeholder="name or ID…" className="w-full" />
                    </td>
                    <td className="px-6 py-2"><div className="flex gap-1 justify-end"><NumInput value={filters.minAvgMeas} onChange={v => setF('minAvgMeas', v)} placeholder="Min" /><NumInput value={filters.maxAvgMeas} onChange={v => setF('maxAvgMeas', v)} placeholder="Max" /></div></td>
                    <td className="px-6 py-2">
                      <div className="flex flex-col gap-1">
                        <input type="date" value={filters.minDate} onChange={e => setF('minDate', e.target.value)} className="text-xs border border-gray-200 rounded px-1 py-1 focus:outline-none focus:border-blue-300 w-full" title="Earliest on or after" />
                        <input type="date" value={filters.maxDate} onChange={e => setF('maxDate', e.target.value)} className="text-xs border border-gray-200 rounded px-1 py-1 focus:outline-none focus:border-blue-300 w-full" title="Latest on or before" />
                      </div>
                    </td>
                  </tr>
                )}
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {summaryResult.isPending ? (
                  (!studyId && !siteId && !studiesListResult.isPending && studiesList.length > 0)
                    ? studiesList.map(study => (
                        <tr key={study.study_id}>
                          <td className={`${STICKY_CTRL_CLASS} bg-white px-3 py-4 w-20`} />
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{study.study_name}</div>
                            <div className="text-sm text-gray-500">{study.study_id}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">{study.study_phase}</td>
                          {Array.from({ length: 8 }).map((_, j) => (
                            <td key={j} className="px-6 py-4 text-right"><Skeleton className="ml-auto" /></td>
                          ))}
                        </tr>
                      ))
                    : Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          <td className={`${STICKY_CTRL_CLASS} bg-white px-3 py-4 w-20`} />
                          <td className="px-6 py-4"><Skeleton width="w-40" className="mb-1" /><Skeleton width="w-20" height="h-3" /></td>
                          {Array.from({ length: 9 }).map((_, j) => (
                            <td key={j} className="px-6 py-4 text-right"><Skeleton className="ml-auto" /></td>
                          ))}
                        </tr>
                      ))
                ) : (
                  sortedRows.flatMap(row => {
                    const isExpanded    = expanded.has(row.study_id);
                    const isSelected    = selectedForCompare.includes(row.study_id);
                    const isDrilldown   = drilldownStudyId === row.study_id;
                    const compareDisabled = selectedForCompare.length >= 2 && !isSelected;
                    const stickyBg      = isSelected ? 'bg-blue-50' : 'bg-white group-hover:bg-gray-50';

                    return [
                      <tr key={row.study_id} className={`group ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                        <td className={`${STICKY_CTRL_CLASS} ${stickyBg} px-3 py-4 w-20`}>
                          <div className="flex items-center justify-center gap-3">
                            <button
                              onClick={() => toggleExpanded(row.study_id)}
                              className="text-sm text-gray-400 hover:text-gray-600 leading-none"
                              aria-label={isExpanded ? 'Collapse' : 'Expand'}
                            >
                              {isExpanded ? '▼' : '▲'}
                            </button>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={compareDisabled}
                              onChange={() => toggleCompare(row.study_id)}
                              title={compareDisabled ? 'Clear a selection first' : 'Select to compare'}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => toggleDrilldown(row.study_id)}
                            className={`text-sm font-medium text-left transition-colors ${isDrilldown ? 'text-indigo-700' : 'text-gray-900 hover:text-indigo-600'}`}
                          >
                            {row.study_name}
                          </button>
                          <div className="text-sm text-gray-500">{row.study_id}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">{row.study_phase}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">{row.participant_count.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">{row.avg_age.toFixed(1)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">{formatAgeRange(row.min_age, row.max_age)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">{row.male_count.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">{row.female_count.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">{row.site_count}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">{row.avg_measurements_per_participant.toFixed(1)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">{formatDateRange(row.earliest_measurement, row.latest_measurement)}</td>
                      </tr>,

                      ...(isDrilldown ? [
                        <tr key={`${row.study_id}-drill`}>
                          <td colSpan={11} className="p-0 border-b border-indigo-200">
                            <DrilldownPanel
                              studyId={row.study_id}
                              studyName={row.study_name}
                              siteId={siteId}
                              page={getDrilldownPage(row.study_id)}
                              onPageChange={p => setDrilldownPage(row.study_id, p)}
                              onClose={() => setDrilldownStudyId(null)}
                            />
                          </td>
                        </tr>,
                      ] : []),

                      ...(isExpanded ? [
                        <tr key={`${row.study_id}-stats`} className="bg-indigo-50/40">
                          <td className={`${STICKY_CTRL_CLASS} bg-indigo-50 px-3 py-2 w-20`} />
                          <td colSpan={10} className="px-6 py-2">
                            <div className="ml-4 flex gap-10 text-xs text-gray-600">
                              <span>
                                <span className="font-medium text-gray-500 uppercase tracking-wide mr-2">Age</span>
                                Mean <strong>{row.avg_age.toFixed(1)}</strong>
                                <span className="mx-1.5 text-gray-300">·</span>
                                Median <strong>{row.median_age.toFixed(1)}</strong>
                                <span className="mx-1.5 text-gray-300">·</span>
                                Mode <strong>{row.mode_age}</strong>
                              </span>
                              <span>
                                <span className="font-medium text-gray-500 uppercase tracking-wide mr-2">Meas/Pt</span>
                                Mean <strong>{row.avg_measurements_per_participant.toFixed(1)}</strong>
                                <span className="mx-1.5 text-gray-300">·</span>
                                Median <strong>{row.median_measurements_per_participant.toFixed(1)}</strong>
                                <span className="mx-1.5 text-gray-300">·</span>
                                Mode <strong>{row.mode_measurements_per_participant}</strong>
                              </span>
                            </div>
                          </td>
                        </tr>,
                      ] : []),

                      ...(isExpanded ? row.sites
                        .filter(site =>
                          !filters.siteContains ||
                          site.site_id.toLowerCase().includes(filters.siteContains.toLowerCase()) ||
                          site.site_name.toLowerCase().includes(filters.siteContains.toLowerCase())
                        )
                        .map(site => (
                        <tr key={`${row.study_id}-site-${site.site_id}`} className="bg-slate-50">
                          <td className={`${STICKY_CTRL_CLASS} bg-slate-50 px-3 py-2 w-20`} />
                          <td className="px-6 py-2 whitespace-nowrap">
                            <div className="pl-4 flex items-start gap-1.5">
                              <span className="text-gray-400 text-xs mt-0.5">↳</span>
                              <div>
                                <div className="text-xs font-medium text-gray-700">{site.site_name}</div>
                                <div className="text-xs text-gray-400">{site.site_id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-2 text-right text-xs text-gray-300">—</td>
                          <td className="px-6 py-2 text-right text-xs text-gray-700">{site.participant_count.toLocaleString()}</td>
                          <td className="px-6 py-2 text-right text-xs text-gray-700">{site.avg_age.toFixed(1)}</td>
                          <td className="px-6 py-2 text-right text-xs text-gray-700">{formatAgeRange(site.min_age, site.max_age)}</td>
                          <td className="px-6 py-2 text-right text-xs text-gray-700">{site.male_count.toLocaleString()}</td>
                          <td className="px-6 py-2 text-right text-xs text-gray-700">{site.female_count.toLocaleString()}</td>
                          <td className="px-6 py-2 text-right text-xs text-gray-300">—</td>
                          <td className="px-6 py-2 text-right text-xs text-gray-700">{site.avg_measurements.toFixed(1)}</td>
                          <td className="px-6 py-2 text-right text-xs text-gray-700">{formatDateRange(site.earliest_measurement, site.latest_measurement)}</td>
                        </tr>
                      )) : []),
                    ];
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {allStudyIds.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Enrollment Timeline</h2>
          <p className="text-sm text-gray-500 mb-4">Daily count of participants by date of first recorded measurement</p>
          <EnrollmentChart studyIds={allStudyIds} studyNames={studyNames} filterStudyId={studyId} />
        </div>
      )}
    </div>
  );
}

export default ParticipantSummary;
