/**
 * AutoApplyPanel Component - Runs automation in background
 * 
 * Flow: Select student → Enter university → Click Start → Automation runs in background
 * - Builds prompt from student data
 * - Calls automation service directly (same as AI Browser)
 * - Shows progress in this panel without navigating away
 * 
 * @file desktop-app/src/src/components/AutoApplyPanel.tsx
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { Bot, Sparkles, Building2, Loader2, CheckCircle, AlertCircle, Terminal, Square } from 'lucide-react';
import {
    startAutomation,
    isServiceRunning,
    connectToTaskUpdates,
    type TaskStatusResponse,
} from '../lib/automation';
import { supabase } from '../lib/supabase';

interface StudentData {
    id: string;
    full_name?: string;
    email?: string;
    phone?: string;
    date_of_birth?: string;
    gender?: string;
    nationality?: string;
    passport_number?: string;
    passport_expiry?: string;
    home_address?: string;
    city?: string;
    country?: string;
    city_of_birth?: string;
    gpa?: string;
    gpa_scale?: string;
    sat_total?: string;
    sat_math?: string;
    sat_reading?: string;
    ielts_overall?: string;
    ielts_listening?: string;
    ielts_reading?: string;
    ielts_writing?: string;
    ielts_speaking?: string;
    toefl_total?: string;
    preferred_major?: string;
    preferred_country?: string;
    preferred_university?: string;
    father_name?: string;
    father_occupation?: string;
    mother_name?: string;
    mother_occupation?: string;
}

interface AutoApplyPanelProps {
    studentData: StudentData | null;
}

interface LogEntry {
    timestamp: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'system';
}

type TaskStatus = 'idle' | 'running' | 'completed' | 'error';

export default function AutoApplyPanel({ studentData }: AutoApplyPanelProps) {
    const [universityName, setUniversityName] = useState('');
    const [serviceReady, setServiceReady] = useState(false);
    const [taskStatus, setTaskStatus] = useState<TaskStatus>('idle');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [suggestions, setSuggestions] = useState<{ name: string; country: string }[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    const wsCleanupRef = useRef<(() => void) | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const isMounted = useRef(true);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Check service status on mount
    useEffect(() => {
        isMounted.current = true;
        checkServiceStatus();

        return () => {
            isMounted.current = false;
            if (wsCleanupRef.current) {
                wsCleanupRef.current();
            }
        };
    }, []);

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const checkServiceStatus = async () => {
        try {
            const running = await isServiceRunning();
            setServiceReady(running);
        } catch {
            setServiceReady(false);
        }
    };

    const addLog = (message: string, type: LogEntry['type'] = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, { timestamp, message, type }]);
    };

    // Search universities with debouncing
    const handleUniversitySearch = async (query: string) => {
        setUniversityName(query);

        if (query.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        // Clear previous timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // Debounce search
        searchTimeoutRef.current = setTimeout(async () => {
            setIsSearching(true);
            console.log('[AutoApply] Searching universities for:', query);
            try {
                const { data, error } = await supabase
                    .from('universities')
                    .select('university_name, country')
                    .ilike('university_name', `%${query}%`)
                    .limit(8);

                console.log('[AutoApply] Search result:', { data, error });

                if (error) {
                    console.error('[AutoApply] Supabase error:', error);
                } else if (data && data.length > 0) {
                    setSuggestions(data.map(d => ({ name: d.university_name, country: d.country })));
                    setShowSuggestions(true);
                    console.log('[AutoApply] Found', data.length, 'universities');
                } else {
                    console.log('[AutoApply] No universities found');
                    setSuggestions([]);
                }
            } catch (err) {
                console.error('[AutoApply] University search error:', err);
            } finally {
                setIsSearching(false);
            }
        }, 200);
    };

    const selectUniversity = (name: string) => {
        setUniversityName(name);
        setShowSuggestions(false);
        setSuggestions([]);
    };

    // Generate password: studentname + year of birth + ")"
    const generatePassword = (student: StudentData): string => {
        const namePart = (student.full_name || 'student').toLowerCase().replace(/\s+/g, '');
        const yearPart = student.date_of_birth ? student.date_of_birth.split('-')[0] : '2000';
        return `${namePart}${yearPart})`;
    };

    // Build the complete prompt for AI agent
    const buildPrompt = useMemo(() => {
        if (!studentData || !universityName) return '';

        const password = generatePassword(studentData);
        const formatValue = (val: string | undefined | null, fallback = 'Not provided') => val || fallback;

        return `## UNIVERSITY APPLICATION TASK

Apply to **${universityName}** for student. Fill forms with data below. STOP before final submission.

### ACCOUNT (if needed)
- Email: ${formatValue(studentData.email)}
- Password: ${password}

### STUDENT INFO
- Name: ${formatValue(studentData.full_name)}
- DOB: ${formatValue(studentData.date_of_birth)}
- Gender: ${formatValue(studentData.gender)}
- Nationality: ${formatValue(studentData.nationality)}
- Phone: ${formatValue(studentData.phone)}
- Email: ${formatValue(studentData.email)}

### ADDRESS
- Address: ${formatValue(studentData.home_address)}
- City: ${formatValue(studentData.city)}, ${formatValue(studentData.country)}

### PASSPORT
- Number: ${formatValue(studentData.passport_number)}
- Expiry: ${formatValue(studentData.passport_expiry)}

### ACADEMICS
- GPA: ${formatValue(studentData.gpa)}${studentData.gpa_scale ? `/${studentData.gpa_scale}` : ''}
- SAT: ${formatValue(studentData.sat_total, 'N/A')} (Math: ${formatValue(studentData.sat_math, 'N/A')}, Reading: ${formatValue(studentData.sat_reading, 'N/A')})
- IELTS: ${formatValue(studentData.ielts_overall, 'N/A')} (L:${formatValue(studentData.ielts_listening, '-')} R:${formatValue(studentData.ielts_reading, '-')} W:${formatValue(studentData.ielts_writing, '-')} S:${formatValue(studentData.ielts_speaking, '-')})
- TOEFL: ${formatValue(studentData.toefl_total, 'N/A')}
- Major: ${formatValue(studentData.preferred_major)}

### FAMILY
- Father: ${formatValue(studentData.father_name)} (${formatValue(studentData.father_occupation, 'N/A')})
- Mother: ${formatValue(studentData.mother_name)} (${formatValue(studentData.mother_occupation, 'N/A')})

### INSTRUCTIONS
1. Go to duckduckgo.com and search "${universityName} undergraduate application portal"
2. Click on the official university application portal (not ads)
3. Create account if needed (use email/password above)
4. Fill ALL form fields with student data
5. For essays: "Essay submitted separately by advisor"
6. Skip document uploads, note what's required
7. **STOP before final Submit button**

Begin now.`;
    }, [studentData, universityName]);

    // Handle task updates from WebSocket
    const lastMessageRef = useRef<string>('');
    const handleTaskUpdate = (update: TaskStatusResponse) => {
        if (!isMounted.current) return;

        // Skip duplicate "Processing..." messages
        const message = update.message || 'Processing...';
        if (message === 'Processing...' && lastMessageRef.current === 'Processing...') {
            return; // Don't spam with repetitive processing messages
        }
        lastMessageRef.current = message;

        // Only log meaningful messages (not just "Processing...")
        if (message !== 'Processing...') {
            addLog(message, 'info');
        }

        if (update.status === 'completed') {
            setTaskStatus('completed');
            addLog('✓ Application automation completed!', 'success');
            // Close WebSocket to stop receiving more updates
            if (wsCleanupRef.current) {
                wsCleanupRef.current();
                wsCleanupRef.current = null;
            }
        } else if (update.status === 'error') {
            setTaskStatus('error');
            addLog(`✗ Error: ${update.message}`, 'error');
            if (wsCleanupRef.current) {
                wsCleanupRef.current();
                wsCleanupRef.current = null;
            }
        }
    };

    const handleTaskError = (error: Error) => {
        if (!isMounted.current) return;
        setTaskStatus('error');
        addLog(`✗ Connection error: ${error.message}`, 'error');
        if (wsCleanupRef.current) {
            wsCleanupRef.current();
            wsCleanupRef.current = null;
        }
    };

    // Start automation - calls API directly, shows progress here
    const handleStartAutomation = async () => {
        if (!studentData || !universityName || !buildPrompt) return;

        if (!serviceReady) {
            addLog('✗ Automation service not ready. Please wait...', 'error');
            await checkServiceStatus();
            return;
        }

        setTaskStatus('running');
        setLogs([]);
        addLog(`🚀 Starting application to ${universityName} for ${studentData.full_name}...`, 'system');

        try {
            // Call the same automation API as AI Browser
            const response = await startAutomation(buildPrompt);

            addLog(`✓ Task started (ID: ${response.task_id})`, 'success');
            addLog('📡 Connecting to live updates...', 'info');

            // Connect WebSocket for real-time updates
            const cleanup = connectToTaskUpdates(
                response.task_id,
                handleTaskUpdate,
                handleTaskError
            );

            wsCleanupRef.current = cleanup;

        } catch (error) {
            setTaskStatus('error');
            addLog(`✗ Failed to start: ${error}`, 'error');
        }
    };

    // Stop/cancel automation
    const handleStop = () => {
        if (wsCleanupRef.current) {
            wsCleanupRef.current();
            wsCleanupRef.current = null;
        }
        setTaskStatus('idle');
        addLog('⏹ Automation stopped', 'system');
    };

    if (!studentData) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                <Bot className="w-16 h-16 mb-4 opacity-30" />
                <h3 className="font-bold text-lg text-slate-500 mb-2">Select a Student</h3>
                <p className="text-sm text-center max-w-xs">Choose a student from the list to start the auto-apply process</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header with student info */}
            <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-purple-50 to-pink-50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shadow">
                            {studentData.full_name?.charAt(0) || '?'}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900">{studentData.full_name}</h3>
                            <p className="text-xs text-slate-500">{studentData.preferred_major || 'No major'} • {studentData.email}</p>
                        </div>
                    </div>

                    {/* Service status */}
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold ${serviceReady ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                        <div className={`w-2 h-2 rounded-full ${serviceReady ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                        {serviceReady ? 'Ready' : 'Offline'}
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-2 mt-3">
                    <div className="bg-white/60 rounded-lg p-1.5 text-center">
                        <p className="text-sm font-black text-emerald-600">{studentData.gpa || '—'}</p>
                        <p className="text-[10px] text-slate-500">GPA</p>
                    </div>
                    <div className="bg-white/60 rounded-lg p-1.5 text-center">
                        <p className="text-sm font-black text-violet-600">{studentData.sat_total || '—'}</p>
                        <p className="text-[10px] text-slate-500">SAT</p>
                    </div>
                    <div className="bg-white/60 rounded-lg p-1.5 text-center">
                        <p className="text-sm font-black text-cyan-600">{studentData.ielts_overall || '—'}</p>
                        <p className="text-[10px] text-slate-500">IELTS</p>
                    </div>
                    <div className="bg-white/60 rounded-lg p-1.5 text-center">
                        <p className="text-sm font-black text-orange-600">{studentData.toefl_total || '—'}</p>
                        <p className="text-[10px] text-slate-500">TOEFL</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* University Input with Autocomplete */}
                <div className="space-y-1.5 relative">
                    <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-purple-500" />
                        University to Apply
                        {isSearching && <Loader2 className="w-3 h-3 animate-spin text-purple-400" />}
                    </label>
                    <input
                        value={universityName}
                        onChange={(e) => handleUniversitySearch(e.target.value)}
                        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        placeholder="Start typing university name..."
                        disabled={taskStatus === 'running'}
                        className="w-full px-3 py-2.5 bg-white rounded-xl border-2 border-slate-200 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all disabled:opacity-50"
                    />

                    {/* Autocomplete Dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                            {suggestions.map((uni, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => selectUniversity(uni.name)}
                                    className="w-full px-3 py-2 text-left hover:bg-purple-50 text-sm flex justify-between items-center border-b border-slate-100 last:border-b-0"
                                >
                                    <span className="text-slate-800 font-medium truncate">{uni.name}</span>
                                    <span className="text-xs text-slate-400 ml-2 flex-shrink-0">{uni.country}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                    {taskStatus !== 'running' ? (
                        <button
                            onClick={handleStartAutomation}
                            disabled={!universityName || !serviceReady}
                            className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                        >
                            <Sparkles className="w-5 h-5" />
                            Start Auto-Apply
                        </button>
                    ) : (
                        <button
                            onClick={handleStop}
                            className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-600 transition-colors shadow-lg"
                        >
                            <Square className="w-5 h-5" />
                            Stop
                        </button>
                    )}
                </div>

                {/* Status indicator with progress bar */}
                {taskStatus !== 'idle' && (
                    <div className={`p-4 rounded-xl ${taskStatus === 'running' ? 'bg-purple-50 border border-purple-200' :
                        taskStatus === 'completed' ? 'bg-green-50 border border-green-200' :
                            'bg-red-50 border border-red-200'
                        }`}>
                        <div className="flex items-center gap-3 mb-2">
                            {taskStatus === 'running' && <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />}
                            {taskStatus === 'completed' && <CheckCircle className="w-5 h-5 text-green-500" />}
                            {taskStatus === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                            <span className="font-bold text-sm">
                                {taskStatus === 'running' ? 'Automation in Progress...' :
                                    taskStatus === 'completed' ? 'Completed Successfully!' :
                                        'Error Occurred'}
                            </span>
                        </div>

                        {/* Progress bar */}
                        {taskStatus === 'running' && (
                            <div className="w-full bg-purple-100 rounded-full h-2 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse"
                                    style={{
                                        width: '100%',
                                        animation: 'progress-indeterminate 2s ease-in-out infinite'
                                    }}
                                />
                            </div>
                        )}

                        {taskStatus === 'completed' && (
                            <div className="w-full bg-green-100 rounded-full h-2 overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full w-full" />
                            </div>
                        )}
                    </div>
                )}

                {/* Live Logs */}
                {logs.length > 0 && (
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                            <Terminal className="w-3.5 h-3.5" />
                            Live Feed
                        </div>
                        <div className="bg-slate-900 rounded-xl p-3 max-h-48 overflow-y-auto font-mono text-xs">
                            {logs.map((log, i) => (
                                <div key={i} className={`py-0.5 ${log.type === 'error' ? 'text-red-400' :
                                    log.type === 'success' ? 'text-green-400' :
                                        log.type === 'system' ? 'text-purple-400' :
                                            'text-slate-300'
                                    }`}>
                                    <span className="text-slate-500">[{log.timestamp}]</span> {log.message}
                                </div>
                            ))}
                            <div ref={logsEndRef} />
                        </div>
                    </div>
                )}

                {/* Service offline warning */}
                {!serviceReady && (
                    <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-700 border border-amber-200">
                        <strong>⚠️ Service Offline</strong>
                        <p className="mt-0.5">Automation service is not running. It should start automatically with the app.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
