import { lazy, Suspense, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { studiesListQuery, studiesOverviewQuery, qualityDistributionQuery } from "./api/queries";

const QualityDashboard = lazy(() => import("./components/QualityDashboard"));
const StudyOverview = lazy(() => import("./components/StudyOverview"));

type Page = "quality" | "overview";

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("overview");
  const [showPercent, setShowPercent] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.prefetchQuery(studiesListQuery);
    queryClient.prefetchQuery(studiesOverviewQuery);
    queryClient.prefetchQuery(qualityDistributionQuery);
  }, [queryClient]);

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="sticky top-0 z-10 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-2xl font-bold text-gray-900">
                  Clinical Quality Dashboard
                </h1>
              </div>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
                <button
                  onClick={() => setCurrentPage("overview")}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    currentPage === "overview"
                      ? "border-blue-500 text-gray-900"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  Study Overview
                </button>
                <button
                  onClick={() => setCurrentPage("quality")}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    currentPage === "quality"
                      ? "border-blue-500 text-gray-900"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  Quality Dashboard
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {currentPage === "quality" && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">0–1</span>
                  <button
                    onClick={() => setShowPercent(prev => !prev)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      showPercent ? "bg-blue-600" : "bg-gray-200"
                    }`}
                    role="switch"
                    aria-checked={showPercent}
                    aria-label="Toggle quality score format"
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      showPercent ? "translate-x-6" : "translate-x-1"
                    }`} />
                  </button>
                  <span className="text-sm text-gray-500">%</span>
                </div>
              )}
              <button
                onClick={handleRefresh}
                className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 rounded px-3 py-1.5 transition-colors"
                title="Clear cache and reload all data"
              >
                ↻ Refresh
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Suspense fallback={
          <div className="flex items-center justify-center h-64">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" />
          </div>
        }>
          {currentPage === "overview" && <StudyOverview />}
          {currentPage === "quality" && <QualityDashboard showPercent={showPercent} />}
        </Suspense>
      </main>
    </div>
  );
}

export default App;
