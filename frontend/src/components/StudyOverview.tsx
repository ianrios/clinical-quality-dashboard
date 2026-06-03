import { useState, useEffect } from 'react';
import type { StudyOverviewResponse } from '../types';

function StudyOverview() {
  const [data, setData] = useState<StudyOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStudyOverview = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/studies/overview');

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: StudyOverviewResponse = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchStudyOverview();
  }, []);

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Study Overview</h2>
        <div className="flex items-center justify-center h-64">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || !data.data.length) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-600">No study data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Study Overview</h2>
        <p className="mt-1 text-sm text-gray-500">
          Summary of all active clinical studies
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.data.map((study) => (
          <div key={study.study_id} className="border border-gray-200 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {study.study_name}
            </h3>
            <div className="text-xs text-gray-500 mb-4">{study.study_id}</div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Phase:</span>
                <span className="text-sm font-medium text-gray-900">{study.study_phase}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Participants:</span>
                <span className="text-sm font-medium text-gray-900">{study.participant_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Measurements:</span>
                <span className="text-sm font-medium text-gray-900">{study.total_measurements}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Sites:</span>
                <span className="text-sm font-medium text-gray-900">{study.site_count}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StudyOverview;
