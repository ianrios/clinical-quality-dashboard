import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { studiesListQuery, qualityDistributionQuery } from '../api/queries';
import { Skeleton } from './Skeleton';
import { TooltipHeader } from './TooltipHeader';

interface Props {
  showPercent?: boolean;
}

function QualityDashboard({ showPercent = false }: Props) {
  const [horizontal, setHorizontal] = useState(true);

  const studiesQuery = useQuery(studiesListQuery);
  const qualityQuery = useQuery(qualityDistributionQuery);

  const qualityMap = new Map(
    qualityQuery.data?.data.map(item => [item.study_id, item]) ?? []
  );

  // Only the Avg Quality score (0–1) converts to %; counts are always raw numbers
  const formatAvgQuality = (score: number) =>
    showPercent ? `${(score * 100).toFixed(1)}%` : score.toFixed(4);

  // Legend labels reflect the threshold notation of the current display mode
  const highKey = showPercent ? 'High Quality (≥90%)' : 'High Quality (≥0.9)';
  const lowKey = showPercent ? 'Low Quality (<80%)' : 'Low Quality (<0.8)';

  // Chart values are always raw counts; only the key names (legend labels) change
  const chartData = qualityQuery.data?.data.map(item => ({
    name: item.study_name.length > 30 ? item.study_name.substring(0, 30) + '...' : item.study_name,
    [highKey]: item.high_quality_count,
    [lowKey]: item.low_quality_count,
  })) ?? [];

  const avgQualityTooltip = showPercent
    ? 'Mean quality score shown as a percentage. ≥90% = High, 80–89% = Medium, <80% = Low'
    : 'Mean quality score across all measurements. Scale: 0–1. ≥0.9 = High, 0.8–0.89 = Medium, <0.8 = Low';

  const highQualityTooltip = showPercent
    ? "Count of measurements scoring ≥90% — meets the threshold for primary analysis"
    : "Count of measurements scoring ≥0.9 — meets the threshold for primary analysis";

  const lowQualityTooltip = showPercent
    ? "Count of measurements scoring <80% — may require review or exclusion. Gap between High and Low is the medium-quality band"
    : "Count of measurements scoring <0.8 — may require review or exclusion. Gap between High and Low is the medium-quality band";

  const studies = studiesQuery.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Quality Score Distribution by Study</h2>
          <p className="mt-1 text-sm text-gray-500">Overview of data quality across all clinical studies</p>
        </div>

        <div className="mb-6">
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
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => setHorizontal(prev => !prev)}
                  className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 rounded px-2 py-1 transition-colors"
                >
                  {horizontal ? 'Vertical view' : 'Horizontal view'}
                </button>
              </div>
              <ResponsiveContainer width="100%" height={400}>
                {horizontal ? (
                  <BarChart layout="vertical" data={chartData} margin={{ right: 200, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v: number) => v.toLocaleString()} />
                    <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => value.toLocaleString()} />
                    <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ paddingLeft: '24px' }} />
                    <Bar dataKey={highKey} fill="#10b981" />
                    <Bar dataKey={lowKey} fill="#ef4444" />
                  </BarChart>
                ) : (
                  <BarChart data={chartData} margin={{ right: 200 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={120} />
                    <YAxis tickFormatter={(v: number) => v.toLocaleString()} />
                    <Tooltip formatter={(value: number) => value.toLocaleString()} />
                    <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ paddingLeft: '24px' }} />
                    <Bar dataKey={highKey} fill="#10b981" />
                    <Bar dataKey={lowKey} fill="#ef4444" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </>
          )}
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Study Details</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <TooltipHeader label="Study" tooltip="The clinical study name and ID" align="left" />
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <TooltipHeader label="Total Measurements" tooltip="Total number of data measurements recorded across all participants and sites in this study" />
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <TooltipHeader label="Avg Quality" tooltip={avgQualityTooltip} />
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <TooltipHeader label="High Quality" tooltip={highQualityTooltip} />
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <TooltipHeader label="Low Quality" tooltip={lowQualityTooltip} />
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {studiesQuery.isPending ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4">
                        <Skeleton width="w-40" className="mb-1" />
                        <Skeleton width="w-20" height="h-3" />
                      </td>
                      <td className="px-6 py-4 text-right"><Skeleton className="ml-auto" /></td>
                      <td className="px-6 py-4 text-right"><Skeleton className="ml-auto" /></td>
                      <td className="px-6 py-4 text-right"><Skeleton className="ml-auto" /></td>
                      <td className="px-6 py-4 text-right"><Skeleton className="ml-auto" /></td>
                    </tr>
                  ))
                ) : (
                  studies.map(study => {
                    const quality = qualityMap.get(study.study_id);
                    return (
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
                            }`}>
                              {formatAvgQuality(quality.avg_quality_score)}
                            </span>
                          ) : (
                            <Skeleton className="ml-auto" />
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {quality ? quality.high_quality_count.toLocaleString() : <Skeleton className="ml-auto" />}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {quality ? quality.low_quality_count.toLocaleString() : <Skeleton className="ml-auto" />}
                        </td>
                      </tr>
                    );
                  })
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
