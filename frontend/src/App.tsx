import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { studiesOverviewQuery, qualityDistributionQuery, participantSummaryQuery } from './api/queries';
import Navbar from './components/Navbar';

const StudyOverview = lazy(() => import('./views/StudyOverview'));
const QualityDashboard = lazy(() => import('./views/QualityDashboard'));
const ParticipantSummary = lazy(() => import('./views/ParticipantSummary'));

function AppContent() {
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.prefetchQuery(studiesOverviewQuery);
    queryClient.prefetchQuery(qualityDistributionQuery);
    queryClient.prefetchQuery(participantSummaryQuery({}));
  }, [queryClient]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Suspense fallback={
          <div className="flex items-center justify-center h-64">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" />
          </div>
        }>
          <Routes>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<StudyOverview />} />
            <Route path="/quality" element={<QualityDashboard />} />
            <Route path="/participants" element={<ParticipantSummary />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
