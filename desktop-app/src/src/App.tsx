import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAppStore } from './store/appStore';
import { useRealtimeSubscriptions } from './hooks/useRealtimeSubscriptions';

// Pages
import LoginPage from './pages/LoginPage';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import StudentDashboard from './pages/student/StudentDashboard';
import SplashScreen from './components/SplashScreen';

function App() {
  const { user, isLoading, isAuthenticated, loadUserProfile, loadStudents, loadMessages } = useAppStore();
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Initialize real-time subscriptions
  useRealtimeSubscriptions();

  // Load user on mount
  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  // Preload all data when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const loadData = async () => {
        try {
          // Add timeout to prevent infinite loading
          const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 10000)
          );

          await Promise.race([
            Promise.all([loadStudents(), loadMessages()]),
            timeout
          ]);
        } catch (error) {
          console.error('Error loading data:', error);
        } finally {
          // Always mark as loaded, even on error
          setIsDataLoaded(true);
        }
      };
      loadData();
    }
  }, [isAuthenticated, user, loadStudents, loadMessages]);

  // Show splash while loading
  if (isLoading) {
    return <SplashScreen message="Loading..." />;
  }

  // Show splash while preloading data
  if (isAuthenticated && !isDataLoaded) {
    return <SplashScreen message="Loading your data..." />;
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
        } />

        {/* Protected routes */}
        <Route path="/*" element={
          !isAuthenticated ? <Navigate to="/login" replace /> : (
            user?.role === 'teacher' ? <TeacherDashboard /> : <StudentDashboard />
          )
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
