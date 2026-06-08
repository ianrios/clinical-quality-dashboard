import { useQuery } from '@tanstack/react-query';
import { studiesListQuery, studiesOverviewQuery } from '../api/queries';
import { Skeleton } from './Skeleton';

function StudyOverview() {
  const studiesListResult = useQuery(studiesListQuery);
  const overviewResult = useQuery(studiesOverviewQuery);

  const overviewMap = new Map(
    overviewResult.data?.data.map(item => [item.study_id, item]) ?? []
  );

  if (studiesListResult.isError) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-700">Failed to load studies</p>
        </div>
      </div>
    );
  }

  const studies = studiesListResult.data?.data ?? [];

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Study Overview</h2>
        <p className="mt-1 text-sm text-gray-500">Summary of all active clinical studies</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {studiesListResult.isPending ? (
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
          studies.map(study => {
            const counts = overviewMap.get(study.study_id);
            return (
              <div key={study.study_id} className="border border-gray-200 rounded-lg p-5">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{study.study_name}</h3>
                <div className="text-xs text-gray-500 mb-3">{study.study_id}</div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Phase:</span>
                    <span className="text-sm font-medium text-gray-900">{study.study_phase}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Participants:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {counts ? counts.participant_count : <Skeleton width="w-12" />}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Measurements:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {counts ? counts.total_measurements : <Skeleton width="w-12" />}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Sites:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {counts ? counts.site_count : <Skeleton width="w-12" />}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default StudyOverview;
