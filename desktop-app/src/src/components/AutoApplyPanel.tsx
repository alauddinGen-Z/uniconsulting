/**
 * Streamlined AutoApplyPanel Component
 * 
 * Simple flow: Select student → Enter university → Click Start → AI does everything
 * - Prompt is built internally and sent directly to AI browser agent
 * - No manual copying needed - fully automated
 * - Password format: studentname + year of birth + ")"
 * 
 * @file desktop-app/src/src/components/AutoApplyPanel.tsx
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import {
    Bot, CheckCircle, AlertCircle, Key,
    ExternalLink, Loader2, Building2, Sparkles
} from 'lucide-react';
import { getGeminiApiKey } from '../lib/supabase';

const AUTOMATION_SERVICE_URL = 'http://127.0.0.1:8765';

interface AutomationProgress {
    status: string;
    progress: number;
    message: string;
    account_credentials?: { email: string; password: string; university: string };
}

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

export default function AutoApplyPanel({ studentData }: AutoApplyPanelProps) {
    // Form inputs
    const [universityName, setUniversityName] = useState('');

    // Automation state
    const [isAutomating, setIsAutomating] = useState(false);
    const [automationProgress, setAutomationProgress] = useState<AutomationProgress | null>(null);
    const [automationTaskId, setAutomationTaskId] = useState<string | null>(null);

    // Config
    const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('gemini_api_key') || getGeminiApiKey());
    const [showApiKeyInput, setShowApiKeyInput] = useState(false);
    const [serviceStatus, setServiceStatus] = useState<'unknown' | 'running' | 'stopped'>('unknown');

    const wsRef = useRef<WebSocket | null>(null);

    // Check service status
    useEffect(() => {
        const checkService = async () => {
            try {
                const response = await fetch(`${AUTOMATION_SERVICE_URL}/health`);
                setServiceStatus(response.ok ? 'running' : 'stopped');
            } catch {
                setServiceStatus('stopped');
            }
        };
        checkService();
        const interval = setInterval(checkService, 10000);
        return () => clearInterval(interval);
    }, []);

    // Generate password: studentname + year of birth + ")"
    const generatePassword = (student: StudentData): string => {
        const namePart = (student.full_name || 'student').toLowerCase().replace(/\s+/g, '');
        const yearPart = student.date_of_birth ? student.date_of_birth.split('-')[0] : '2000';
        return `${namePart}${yearPart})`;
    };

    // Build the complete prompt for AI agent (sent directly, not shown to user)
    const buildPrompt = useMemo(() => {
        if (!studentData || !universityName) return '';

        const password = generatePassword(studentData);
        const formatValue = (val: string | undefined | null, fallback = 'Not provided') => val || fallback;

        return `## UNIVERSITY APPLICATION TASK

You are applying to **${universityName}** for the following student. Fill all forms with the data below and STOP before final submission.

---

### ACCOUNT CREATION (if needed)
If the university requires account creation:
- **Email**: ${formatValue(studentData.email)}
- **Password**: ${password}
- Report these credentials in your response

---

### STUDENT PERSONAL INFORMATION

**Full Name**: ${formatValue(studentData.full_name)}
**Email**: ${formatValue(studentData.email)}
**Phone**: ${formatValue(studentData.phone)}
**Date of Birth**: ${formatValue(studentData.date_of_birth)}
**Gender**: ${formatValue(studentData.gender)}
**Nationality**: ${formatValue(studentData.nationality)}
**City of Birth**: ${formatValue(studentData.city_of_birth)}

**Passport Number**: ${formatValue(studentData.passport_number)}
**Passport Expiry**: ${formatValue(studentData.passport_expiry)}

**Home Address**: ${formatValue(studentData.home_address)}
**City**: ${formatValue(studentData.city)}
**Country**: ${formatValue(studentData.country)}

---

### ACADEMIC QUALIFICATIONS

**GPA**: ${formatValue(studentData.gpa)}${studentData.gpa_scale ? ` / ${studentData.gpa_scale}` : ''}

**SAT Scores**:
- Total: ${formatValue(studentData.sat_total, 'N/A')}
- Math: ${formatValue(studentData.sat_math, 'N/A')}
- Reading/Writing: ${formatValue(studentData.sat_reading, 'N/A')}

**IELTS Scores**:
- Overall: ${formatValue(studentData.ielts_overall, 'N/A')}
- Listening: ${formatValue(studentData.ielts_listening, 'N/A')}
- Reading: ${formatValue(studentData.ielts_reading, 'N/A')}
- Writing: ${formatValue(studentData.ielts_writing, 'N/A')}
- Speaking: ${formatValue(studentData.ielts_speaking, 'N/A')}

**TOEFL Total**: ${formatValue(studentData.toefl_total, 'N/A')}

**Preferred Major**: ${formatValue(studentData.preferred_major)}

---

### FAMILY INFORMATION

**Father**: ${formatValue(studentData.father_name)} (${formatValue(studentData.father_occupation, 'Occupation not specified')})
**Mother**: ${formatValue(studentData.mother_name)} (${formatValue(studentData.mother_occupation, 'Occupation not specified')})

---

### INSTRUCTIONS

1. Go to Google and search for "${universityName} undergraduate application"
2. Navigate to the official application portal
3. If account creation is required, use the email and password above
4. Fill ALL form fields with the student information above
5. For fields not available, select "Other" or leave blank if optional
6. For essay questions, write: "Essay will be submitted separately by advisor"
7. For document uploads, skip and note which documents are required
8. **CRITICAL: STOP before clicking final Submit button**
9. Report status as "Ready for Review" with summary of filled fields

Begin now.`;
    }, [studentData, universityName]);

    // Save API key
    const saveApiKey = (key: string) => {
        setGeminiApiKey(key);
        localStorage.setItem('gemini_api_key', key);
        setShowApiKeyInput(false);
    };

    // Start automation - sends prompt directly to AI agent
    const startAutomation = async () => {
        if (!studentData || !universityName || !geminiApiKey) return;

        setIsAutomating(true);
        setAutomationProgress({ status: 'starting', progress: 0, message: 'Initializing AI browser agent...' });

        try {
            const response = await fetch(`${AUTOMATION_SERVICE_URL}/api/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_id: studentData.id,
                    student_data: studentData,
                    university_name: universityName,
                    major: studentData.preferred_major,
                    mode: 'semi', // Always semi-auto for safety
                    gemini_api_key: geminiApiKey,
                    custom_prompt: buildPrompt
                })
            });

            const result = await response.json();
            setAutomationTaskId(result.task_id);

            // Connect WebSocket for progress
            const ws = new WebSocket(`ws://127.0.0.1:8765/ws/progress/${result.task_id}`);
            wsRef.current = ws;

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                setAutomationProgress(data);
                if (['completed', 'error', 'cancelled'].includes(data.status)) {
                    setIsAutomating(false);
                    ws.close();
                }
            };

            ws.onerror = () => {
                setAutomationProgress({ status: 'error', progress: 0, message: 'Connection to automation service failed' });
                setIsAutomating(false);
            };
        } catch (error) {
            setAutomationProgress({ status: 'error', progress: 0, message: `Failed to start: ${error}` });
            setIsAutomating(false);
        }
    };

    // Confirm submission (semi-auto mode)
    const confirmSubmission = async (action: 'submit' | 'cancel') => {
        if (!automationTaskId) return;
        try {
            await fetch(`${AUTOMATION_SERVICE_URL}/api/confirm/${automationTaskId}?action=${action}`, { method: 'POST' });
        } catch (error) {
            console.error('Confirm error:', error);
        }
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
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-purple-50 to-pink-50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                            {studentData.full_name?.charAt(0) || '?'}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 text-lg">{studentData.full_name}</h3>
                            <p className="text-sm text-slate-500">{studentData.preferred_major || 'No major set'} • {studentData.email}</p>
                        </div>
                    </div>

                    {/* Service Status */}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${serviceStatus === 'running' ? 'bg-green-100 text-green-700' :
                        serviceStatus === 'stopped' ? 'bg-red-100 text-red-700' :
                            'bg-slate-100 text-slate-500'
                        }`}>
                        <div className={`w-2 h-2 rounded-full ${serviceStatus === 'running' ? 'bg-green-500 animate-pulse' :
                            serviceStatus === 'stopped' ? 'bg-red-500' : 'bg-slate-400'
                            }`} />
                        {serviceStatus === 'running' ? 'AI Ready' : serviceStatus === 'stopped' ? 'Offline' : '...'}
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-2 mt-4">
                    <div className="bg-white/60 rounded-lg p-2 text-center">
                        <p className="text-lg font-black text-emerald-600">{studentData.gpa || '—'}</p>
                        <p className="text-xs text-slate-500">GPA</p>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2 text-center">
                        <p className="text-lg font-black text-violet-600">{studentData.sat_total || '—'}</p>
                        <p className="text-xs text-slate-500">SAT</p>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2 text-center">
                        <p className="text-lg font-black text-cyan-600">{studentData.ielts_overall || '—'}</p>
                        <p className="text-xs text-slate-500">IELTS</p>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2 text-center">
                        <p className="text-lg font-black text-orange-600">{studentData.toefl_total || '—'}</p>
                        <p className="text-xs text-slate-500">TOEFL</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* API Key Config */}
                {!geminiApiKey && !showApiKeyInput && (
                    <button
                        onClick={() => setShowApiKeyInput(true)}
                        className="w-full p-4 bg-amber-50 border border-amber-200 rounded-xl text-left hover:bg-amber-100 transition-colors"
                    >
                        <div className="flex items-center gap-2 text-amber-700">
                            <Key className="w-5 h-5" />
                            <span className="font-bold">Configure Gemini API Key</span>
                        </div>
                        <p className="text-xs text-amber-600 mt-1">Required for AI browser automation</p>
                    </button>
                )}

                {showApiKeyInput && (
                    <div className="p-4 bg-slate-50 rounded-xl space-y-3 border border-slate-200">
                        <input
                            type="password"
                            value={geminiApiKey}
                            onChange={(e) => setGeminiApiKey(e.target.value)}
                            placeholder="Enter your Gemini API Key..."
                            className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm"
                        />
                        <div className="flex gap-2">
                            <button onClick={() => saveApiKey(geminiApiKey)} className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-bold hover:bg-purple-600">Save</button>
                            <button onClick={() => setShowApiKeyInput(false)} className="px-4 py-2 bg-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-300">Cancel</button>
                            <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="ml-auto text-sm text-purple-500 hover:underline flex items-center gap-1">
                                Get Key <ExternalLink className="w-4 h-4" />
                            </a>
                        </div>
                    </div>
                )}

                {/* University Input */}
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-purple-500" />
                        University to Apply
                    </label>
                    <input
                        value={universityName}
                        onChange={(e) => setUniversityName(e.target.value)}
                        placeholder="Enter university name (e.g., MIT, Stanford, Harvard)"
                        disabled={isAutomating}
                        className="w-full px-4 py-3 bg-white rounded-xl border-2 border-slate-200 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all"
                    />
                </div>

                {/* Start Button */}
                <button
                    onClick={startAutomation}
                    disabled={isAutomating || !universityName || !geminiApiKey || serviceStatus !== 'running'}
                    className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
                >
                    {isAutomating ? (
                        <><Loader2 className="w-6 h-6 animate-spin" /> AI is Working...</>
                    ) : (
                        <><Sparkles className="w-6 h-6" /> Start Auto-Apply</>
                    )}
                </button>

                {universityName && !isAutomating && (
                    <p className="text-center text-xs text-slate-400">
                        AI will fill the {universityName} application form with {studentData.full_name}'s data
                    </p>
                )}

                {/* Progress Display */}
                {automationProgress && (
                    <div className={`p-4 rounded-xl ${automationProgress.status === 'error' ? 'bg-red-50 border border-red-200' :
                        automationProgress.status === 'completed' ? 'bg-green-50 border border-green-200' :
                            'bg-purple-50 border border-purple-200'
                        }`}>
                        <div className="flex items-center gap-2 mb-2">
                            {automationProgress.status === 'error' ? (
                                <AlertCircle className="w-5 h-5 text-red-500" />
                            ) : automationProgress.status === 'completed' ? (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : (
                                <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
                            )}
                            <span className="font-bold text-sm capitalize">{automationProgress.status.replace('_', ' ')}</span>
                        </div>
                        <p className="text-sm text-slate-600">{automationProgress.message}</p>

                        {/* Progress Bar */}
                        {automationProgress.progress > 0 && automationProgress.status !== 'error' && (
                            <div className="mt-3 h-2 bg-white rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                                    style={{ width: `${automationProgress.progress}%` }}
                                />
                            </div>
                        )}

                        {/* Account Credentials */}
                        {automationProgress.account_credentials && (
                            <div className="mt-4 p-3 bg-white rounded-lg border border-purple-200">
                                <p className="text-xs font-bold text-purple-600 uppercase mb-2">🔐 Portal Account Created</p>
                                <p className="text-sm font-mono"><strong>Email:</strong> {automationProgress.account_credentials.email}</p>
                                <p className="text-sm font-mono"><strong>Password:</strong> {automationProgress.account_credentials.password}</p>
                            </div>
                        )}

                        {/* Confirm Buttons for Semi-Auto */}
                        {automationProgress.status === 'awaiting_confirmation' && (
                            <div className="mt-4 flex gap-2">
                                <button
                                    onClick={() => confirmSubmission('submit')}
                                    className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors"
                                >
                                    ✓ Submit Application
                                </button>
                                <button
                                    onClick={() => confirmSubmission('cancel')}
                                    className="flex-1 py-3 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Status Messages */}
                {serviceStatus === 'stopped' && (
                    <div className="p-4 bg-red-50 rounded-xl text-sm text-red-700 border border-red-200">
                        <strong>⚠️ AI Service Offline</strong>
                        <p className="text-xs mt-1">The automation service should start automatically. Try restarting the app.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
