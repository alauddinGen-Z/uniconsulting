import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { useAppStore } from './store/appStore';
import { useRealtimeSubscriptions } from './hooks/useRealtimeSubscriptions';
import { supabase, restoreSessionFromIPC } from './lib/supabase';

// Offline-First PowerSync (TODO: Enable when PowerSync is configured)
// import { initPowerSync, disconnectPowerSync, isPowerSyncConnected } from './lib/powersync';

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

    // Load profile using direct fetch with provided access token
    // This bypasses any issues with the Supabase client storage
    const loadProfile = async (userId: string, email: string, accessToken: string) => {
      console.log('[App] Loading profile for:', email, 'userId:', userId);
      console.log('[App] Has access token:', !!accessToken);

      if (!accessToken) {
        console.error('[App] No access token provided');
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        // Use direct fetch with explicit timeout and auth header
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        console.log('[App] Fetching profile from Supabase REST API...');
        const response = await fetch(
          `https://ylwyuogdfwugjexyhtrq.supabase.co/rest/v1/profiles?id=eq.${userId}&select=*`,
          {
            method: 'GET',
            headers: {
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlsd3l1b2dkZnd1Z2pleHlodHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0NjExODEsImV4cCI6MjA4MDAzNzE4MX0.clEe8v_lzTXJrOQJsAUn18CCHx3JRHCcBficHqwP-1g',
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            signal: controller.signal
          }
        );

        clearTimeout(timeoutId);
        console.log('[App] Fetch response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[App] Profile HTTP error:', response.status, errorText);
          setUser(null);
        } else {
          const profiles = await response.json();
          console.log('[App] Profile data received:', profiles?.length, 'records');

          if (profiles && profiles.length > 0) {
            console.log('[App] ✓ Profile loaded:', profiles[0].full_name, profiles[0].role);
            setUser(profiles[0]);
          } else {
            console.log('[App] No profile found for userId:', userId);
            setUser(null);
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.error('[App] Profile fetch timed out after 10s');
        } else {
          console.error('[App] Profile fetch exception:', err);
        }
        setUser(null);
      }

      setLoading(false);
    };

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[App] Auth state changed:', event, session?.user?.email);

      if (session?.user && session.access_token) {
        // Pass access_token directly from session callback
        await loadProfile(session.user.id, session.user.email || '', session.access_token);
      } else {
        console.log('[App] No session, clearing user');
        setUser(null);
        setLoading(false);
      }
    });

    // Try to restore session on mount
    const initSession = async () => {
      // Try IPC restoration first (Electron desktop app)
      const restored = await restoreSessionFromIPC();
      if (restored) {
        console.log('[App] Session restored from IPC storage');
        return; // onAuthStateChange will fire with the restored session
      }

      // Fallback: Check current session on mount
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[App] Initial session check:', session?.user?.email || 'none');
      if (session?.user && session.access_token) {
        await loadProfile(session.user.id, session.user.email || '', session.access_token);
      } else {
        setLoading(false);
      }
    };

    initSession();

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

      const dataTimeout = setTimeout(() => {
        if (!isDataLoaded) {
          console.warn('[App] Data loading timeout - proceeding with available data');
          setIsDataLoaded(true);
        }
      }, 8000);

      Promise.all([
        loadStudents().catch((e: any) => console.error('loadStudents error:', e)),
        loadMessages().catch((e: any) => console.error('loadMessages error:', e))
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
