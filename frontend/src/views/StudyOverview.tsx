import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { studiesOverviewQuery } from '../api/queries';
import { Skeleton } from '../components/Skeleton';

function StudyOverview() {
  const overviewResult = useQuery(studiesOverviewQuery);

  const studies = useMemo(() => overviewResult.data?.data ?? [], [overviewResult.data]);

  if (overviewResult.isError) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-700">Failed to load studies</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Study Overview</h2>
        <p className="mt-1 text-sm text-gray-500">Summary of all active clinical studies</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {overviewResult.isPending ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-5">
              <Skeleton width="w-3/4" height="h-5" className="mb-2" />
              <Skeleton width="w-1/4" height="h-3" className="mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="flex justify-between">
                    <Skeleton width="w-20" />
                    <Skeleton width="w-10" />
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          studies.map(study => (
            <div key={study.study_id} className="border border-gray-200 rounded-lg p-5">
              <div className="flex items-start justify-between mb-1 gap-2">
                <h3 className="text-lg font-semibold text-gray-900">{study.study_name}</h3>
                <Link
                  to={`/participants?study=${study.study_id}`}
                  className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 rounded px-2 py-0.5 whitespace-nowrap transition-colors shrink-0"
                >
                  Participants →
                </Link>
              </div>
              <div className="text-xs text-gray-500 mb-3">{study.study_id}</div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Phase:</span>
                  <span className="text-sm font-medium text-gray-900">{study.study_phase}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Participants:</span>
                  <span className="text-sm font-medium text-gray-900">{study.participant_count.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Measurements:</span>
                  <span className="text-sm font-medium text-gray-900">{study.total_measurements.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Sites:</span>
                  <span className="text-sm font-medium text-gray-900">{study.site_count}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default StudyOverview;
