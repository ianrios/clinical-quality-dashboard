import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { QualityDistributionResponse } from '../types';

function QualityDashboard() {
  const [data, setData] = useState<QualityDistributionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchCount, setFetchCount] = useState(0);

  const fetchQualityData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/quality/distribution');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: QualityDistributionResponse = await response.json();
      setData(result);
      if (fetchCount < 3) {
        setFetchCount(fetchCount + 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQualityData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchCount]);

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Quality Score Distribution by Study</h2>
        <div className="flex flex-col items-center justify-center h-96">
          <div className="relative">
            <div className="inline-block h-16 w-16 animate-spin rounded-full border-8 border-solid border-blue-600 border-r-transparent"></div>
            <div className="absolute top-0 left-0 h-16 w-16 animate-ping rounded-full border-4 border-blue-400 opacity-20"></div>
          </div>
          <p className="mt-6 text-lg text-gray-600 font-medium">Loading quality data...</p>
          <p className="mt-2 text-sm text-gray-400">Analyzing 500,000+ measurements</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading data</h3>
              <p className="mt-2 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
        <button
          onClick={fetchQualityData}
          className="mt-4 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data || !data.data.length) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-600">No quality data available</p>
      </div>
    );
  }

  const chartData = data.data.map(item => ({
    name: item.study_name.length > 30 ? item.study_name.substring(0, 30) + '...' : item.study_name,
    'High Quality (≥0.9)': item.high_quality_count,
    'Low Quality (<0.8)': item.low_quality_count,
    avgQuality: (parseFloat(item.avg_quality_score.toString()) * 100).toFixed(1)
  }));

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Quality Score Distribution by Study</h2>
          <p className="mt-1 text-sm text-gray-500">
            Overview of data quality across all clinical studies
          </p>
        </div>

        <div className="mb-6">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={120} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="High Quality (≥0.9)" fill="#10b981" />
              <Bar dataKey="Low Quality (<0.8)" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Study Details</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Study
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Measurements
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Quality
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    High Quality
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Low Quality
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.data.map((item) => (
                  <tr key={item.study_id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{item.study_name}</div>
                        <div className="text-sm text-gray-500">{item.study_id}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {item.total_measurements}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`inline-flex text-sm font-medium ${
                        parseFloat(item.avg_quality_score.toString()) >= 0.9
                          ? 'text-green-600'
                          : parseFloat(item.avg_quality_score.toString()) >= 0.8
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}>
                        {parseFloat(item.avg_quality_score.toString()).toFixed(4)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {item.high_quality_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {item.low_quality_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QualityDashboard;
