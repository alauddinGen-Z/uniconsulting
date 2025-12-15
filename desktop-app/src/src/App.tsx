import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { useAppStore } from './store/appStore';
import { useRealtimeSubscriptions } from './hooks/useRealtimeSubscriptions';
import { supabase } from './lib/supabase';

// Pages
import LoginPage from './pages/LoginPage';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import StudentDashboard from './pages/student/StudentDashboard';
import SplashScreen from './components/SplashScreen';

function App() {
  const { user, isLoading, isAuthenticated, setUser, setLoading, loadStudents, loadMessages } = useAppStore();
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const authInitialized = useRef(false);

  // Initialize real-time subscriptions
  useRealtimeSubscriptions();

  // Setup auth state listener - This is the PRIMARY auth mechanism
  useEffect(() => {
    if (authInitialized.current) return;
    authInitialized.current = true;

    console.log('[App] Setting up auth state listener...');

    // Helper function to load profile
    const loadProfile = async (userId: string, email: string) => {
      console.log('[App] Loading profile for:', email);
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[App] Profile load error:', error.message);
        setUser(null);
      } else if (profile) {
        console.log('[App] Profile loaded:', profile.full_name, profile.email);
        setUser(profile);
      } else {
        console.log('[App] No profile found');
        setUser(null);
      }
      setLoading(false);
    };

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[App] Auth state changed:', event, session?.user?.email);

      if (session?.user) {
        await loadProfile(session.user.id, session.user.email || '');
      } else {
        console.log('[App] No session, clearing user');
        setUser(null);
        setLoading(false);
      }
    });

    // Also check current session on mount (for page refresh)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('[App] Initial session check:', session?.user?.email || 'none');
      if (session?.user) {
        await loadProfile(session.user.id, session.user.email || '');
      } else {
        setLoading(false);
      }
    });

    // Timeout fallback - if still loading after 5 seconds, force stop
    const timeout = setTimeout(() => {
      if (useAppStore.getState().isLoading) {
        console.log('[App] Auth timeout - forcing stop');
        setLoading(false);
      }
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [setUser, setLoading]);

  // Preload all data when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user && !isDataLoaded) {
      console.log('[App] Loading user data...');

      // Timeout fallback - if data loading takes too long, proceed anyway
      const dataTimeout = setTimeout(() => {
        if (!isDataLoaded) {
          console.warn('[App] Data loading timeout - proceeding with available data');
          setIsDataLoaded(true);
        }
      }, 8000); // 8 second timeout for data loading

      Promise.all([
        loadStudents().catch(e => console.error('loadStudents error:', e)),
        loadMessages().catch(e => console.error('loadMessages error:', e))
      ]).finally(() => {
        console.log('[App] Data loaded');
        setIsDataLoaded(true);
        clearTimeout(dataTimeout);
      });

      return () => clearTimeout(dataTimeout);
    }
  }, [isAuthenticated, user, isDataLoaded, loadStudents, loadMessages]);

  // Reset data loaded state when user changes
  useEffect(() => {
    if (!isAuthenticated) {
      setIsDataLoaded(false);
    }
  }, [isAuthenticated]);

  // Show splash while loading auth
  if (isLoading) {
    return <SplashScreen message="Loading..." showLogout />;
  }

  // Show splash while preloading data
  if (isAuthenticated && !isDataLoaded) {
    return <SplashScreen message="Loading your data..." showLogout />;
  }

  return (
    <HashRouter>
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
    </HashRouter>
  );
}

export default App;

