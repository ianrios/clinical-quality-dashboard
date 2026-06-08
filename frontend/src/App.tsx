import { useState } from "react";
import QualityDashboard from "./components/QualityDashboard";
import StudyOverview from "./components/StudyOverview";

type Page = "quality" | "overview";

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("overview");

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
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {currentPage === "overview" && <StudyOverview />}
        {currentPage === "quality" && <QualityDashboard />}
      </main>
    </div>
  );
}

export default App;
