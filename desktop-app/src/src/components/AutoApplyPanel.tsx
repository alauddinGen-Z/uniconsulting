/**
 * Enhanced AutoApplyPanel Component
 * 
 * Features:
 * - Smart Prompt Template Maker with student data
 * - University + Major input for targeted applications
 * - Prompt Preview panel with copy functionality
 * - Multi-agent batch mode for applying to multiple students
 * 
 * @file desktop-app/src/src/components/AutoApplyPanel.tsx
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import {
    Bot, Play, CheckCircle, AlertCircle, Key, Copy, Check,
    ExternalLink, Loader2, Building2, BookOpen,
    Users, Plus, Trash2, Eye, FileText, Sparkles
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

interface QueuedApplication {
    id: string;
    student: StudentData;
    university: string;
    major: string;
    status: 'queued' | 'running' | 'completed' | 'error';
    message?: string;
}

interface AutoApplyPanelProps {
    studentData: StudentData | null;
}

export default function AutoApplyPanel({ studentData }: AutoApplyPanelProps) {
    // Form inputs
    const [universityName, setUniversityName] = useState('');
    const [major, setMajor] = useState('');
    const [automationMode, setAutomationMode] = useState<'semi' | 'full'>('semi');

    // Automation state
    const [isAutomating, setIsAutomating] = useState(false);
    const [automationProgress, setAutomationProgress] = useState<AutomationProgress | null>(null);
    const [automationTaskId, setAutomationTaskId] = useState<string | null>(null);

    // Config
    const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('gemini_api_key') || getGeminiApiKey());
    const [showApiKeyInput, setShowApiKeyInput] = useState(false);
    const [serviceStatus, setServiceStatus] = useState<'unknown' | 'running' | 'stopped'>('unknown');

    // Prompt preview
    const [showPromptPreview, setShowPromptPreview] = useState(true);
    const [copiedPrompt, setCopiedPrompt] = useState(false);

    // Batch mode
    const [batchMode, setBatchMode] = useState(false);
    const [applicationQueue, setApplicationQueue] = useState<QueuedApplication[]>([]);

    const wsRef = useRef<WebSocket | null>(null);

    // Auto-fill major from student data
    useEffect(() => {
        if (studentData?.preferred_major && !major) {
            setMajor(studentData.preferred_major);
        }
    }, [studentData]);

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

    // Generate comprehensive prompt from student data
    const generatedPrompt = useMemo(() => {
        if (!studentData || !universityName) return '';

        const formatValue = (val: string | undefined | null) => val || '(not provided)';

        return `## University Application Agent Task

### Target Application
- **University**: ${universityName}
- **Major/Program**: ${major || studentData.preferred_major || '(to be selected)'}
- **Mode**: ${automationMode === 'semi' ? 'Stop before final submit for review' : 'Complete submission (with safety guardrail)'}

---

### Student Personal Information

**Basic Details:**
- Full Name: ${formatValue(studentData.full_name)}
- Date of Birth: ${formatValue(studentData.date_of_birth)}
- Gender: ${formatValue(studentData.gender)}
- Nationality: ${formatValue(studentData.nationality)}
- City of Birth: ${formatValue(studentData.city_of_birth)}

**Passport:**
- Passport Number: ${formatValue(studentData.passport_number)}
- Expiry Date: ${formatValue(studentData.passport_expiry)}

**Contact:**
- Email: ${formatValue(studentData.email)}
- Phone: ${formatValue(studentData.phone)}

**Address:**
- Home Address: ${formatValue(studentData.home_address)}
- City: ${formatValue(studentData.city)}
- Country: ${formatValue(studentData.country)}

---

### Academic Qualifications

**GPA:**
- Score: ${formatValue(studentData.gpa)}${studentData.gpa_scale ? ` / ${studentData.gpa_scale}` : ''}

**SAT Scores:**
- Total: ${formatValue(studentData.sat_total)}
- Math: ${formatValue(studentData.sat_math)}
- Reading/Writing: ${formatValue(studentData.sat_reading)}

**IELTS Scores:**
- Overall: ${formatValue(studentData.ielts_overall)}
- Listening: ${formatValue(studentData.ielts_listening)}
- Reading: ${formatValue(studentData.ielts_reading)}
- Writing: ${formatValue(studentData.ielts_writing)}
- Speaking: ${formatValue(studentData.ielts_speaking)}

**TOEFL:**
- Total: ${formatValue(studentData.toefl_total)}

---

### Family Information

**Father:**
- Name: ${formatValue(studentData.father_name)}
- Occupation: ${formatValue(studentData.father_occupation)}

**Mother:**
- Name: ${formatValue(studentData.mother_name)}
- Occupation: ${formatValue(studentData.mother_occupation)}

---

### Instructions for Agent

1. Search for "${universityName} undergraduate application portal" or similar
2. Navigate to the official university website
3. If account creation is required:
   - Use email: ${studentData.email}
   - Generate a secure password and report it
4. Fill all application form fields with the above information
5. For fields not provided, select "Other" or leave blank if optional
6. For essay/personal statement fields, write: "Essay will be submitted separately"
7. For document uploads, skip and note which documents are required
8. **CRITICAL: ${automationMode === 'semi' ? 'STOP before clicking the final Submit button. Report status as "Ready for Review"' : 'Complete the submission but report any confirmation received'}**

Begin the application process now.`;
    }, [studentData, universityName, major, automationMode]);

    // Save API key
    const saveApiKey = (key: string) => {
        setGeminiApiKey(key);
        localStorage.setItem('gemini_api_key', key);
        setShowApiKeyInput(false);
    };

    // Copy prompt to clipboard
    const handleCopyPrompt = () => {
        navigator.clipboard.writeText(generatedPrompt);
        setCopiedPrompt(true);
        setTimeout(() => setCopiedPrompt(false), 2000);
    };

    // Start automation
    const startAutomation = async () => {
        if (!studentData || !universityName || !geminiApiKey) return;

        setIsAutomating(true);
        setAutomationProgress({ status: 'starting', progress: 0, message: 'Connecting to automation service...' });

        try {
            const response = await fetch(`${AUTOMATION_SERVICE_URL}/api/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_id: studentData.id,
                    student_data: studentData,
                    university_name: universityName,
                    major: major || studentData.preferred_major,
                    mode: automationMode,
                    gemini_api_key: geminiApiKey,
                    custom_prompt: generatedPrompt
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
                setAutomationProgress({ status: 'error', progress: 0, message: 'WebSocket connection failed' });
                setIsAutomating(false);
            };
        } catch (error) {
            setAutomationProgress({ status: 'error', progress: 0, message: `Failed: ${error}` });
            setIsAutomating(false);
        }
    };

    // Add to batch queue
    const addToQueue = () => {
        if (!studentData || !universityName) return;

        const newApp: QueuedApplication = {
            id: `${studentData.id}-${Date.now()}`,
            student: studentData,
            university: universityName,
            major: major || studentData.preferred_major || '',
            status: 'queued'
        };

        setApplicationQueue(prev => [...prev, newApp]);
        setUniversityName('');
    };

    // Remove from queue
    const removeFromQueue = (id: string) => {
        setApplicationQueue(prev => prev.filter(app => app.id !== id));
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
            <div className="p-8 text-center text-slate-400">
                <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Select a student to use Auto-Apply</p>
                <p className="text-xs mt-1">Choose from the student list on the left</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-purple-50 to-pink-50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900">AI Auto-Apply</h3>
                            <p className="text-xs text-slate-500">Smart prompt generation for {studentData.full_name}</p>
                        </div>
                    </div>

                    {/* Service Status + Mode Toggle */}
                    <div className="flex items-center gap-3">
                        {/* Batch Mode Toggle */}
                        <button
                            onClick={() => setBatchMode(!batchMode)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${batchMode
                                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                }`}
                        >
                            <Users className="w-3.5 h-3.5" />
                            Batch
                        </button>

                        {/* Service Status */}
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${serviceStatus === 'running' ? 'bg-green-100 text-green-700' :
                            serviceStatus === 'stopped' ? 'bg-red-100 text-red-700' :
                                'bg-slate-100 text-slate-500'
                            }`}>
                            <div className={`w-2 h-2 rounded-full ${serviceStatus === 'running' ? 'bg-green-500 animate-pulse' :
                                serviceStatus === 'stopped' ? 'bg-red-500' : 'bg-slate-400'
                                }`} />
                            {serviceStatus === 'running' ? 'Ready' : serviceStatus === 'stopped' ? 'Offline' : '...'}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* API Key Config */}
                {!geminiApiKey && !showApiKeyInput && (
                    <button
                        onClick={() => setShowApiKeyInput(true)}
                        className="w-full p-3 bg-amber-50 border border-amber-200 rounded-xl text-left hover:bg-amber-100 transition-colors"
                    >
                        <div className="flex items-center gap-2 text-amber-700">
                            <Key className="w-4 h-4" />
                            <span className="text-sm font-medium">Configure Gemini API Key</span>
                        </div>
                    </button>
                )}

                {showApiKeyInput && (
                    <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                        <input
                            type="password"
                            value={geminiApiKey}
                            onChange={(e) => setGeminiApiKey(e.target.value)}
                            placeholder="Gemini API Key..."
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
                        />
                        <div className="flex gap-2">
                            <button onClick={() => saveApiKey(geminiApiKey)} className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-bold">Save</button>
                            <button onClick={() => setShowApiKeyInput(false)} className="px-4 py-2 bg-slate-200 text-slate-600 rounded-lg text-sm">Cancel</button>
                            <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-purple-500 hover:underline flex items-center gap-1">
                                Get Key <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    </div>
                )}

                {/* Application Form */}
                <div className="grid grid-cols-2 gap-3">
                    {/* University Input */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                            <Building2 className="w-3 h-3" /> University
                        </label>
                        <input
                            value={universityName}
                            onChange={(e) => setUniversityName(e.target.value)}
                            placeholder="e.g. MIT, Stanford, Harvard..."
                            disabled={isAutomating}
                            className="w-full px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300 outline-none"
                        />
                    </div>

                    {/* Major Input */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                            <BookOpen className="w-3 h-3" /> Major/Program
                        </label>
                        <input
                            value={major}
                            onChange={(e) => setMajor(e.target.value)}
                            placeholder={studentData.preferred_major || "e.g. Computer Science..."}
                            disabled={isAutomating}
                            className="w-full px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300 outline-none"
                        />
                    </div>
                </div>

                {/* Mode Selection */}
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Automation Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setAutomationMode('semi')}
                            disabled={isAutomating}
                            className={`p-3 rounded-xl border text-left transition-all ${automationMode === 'semi'
                                ? 'bg-purple-50 border-purple-300 text-purple-700'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-purple-200'
                                }`}
                        >
                            <div className="font-bold text-sm">Semi-Auto</div>
                            <div className="text-xs opacity-70">Review before submit</div>
                        </button>
                        <button
                            onClick={() => setAutomationMode('full')}
                            disabled={isAutomating}
                            className={`p-3 rounded-xl border text-left transition-all ${automationMode === 'full'
                                ? 'bg-purple-50 border-purple-300 text-purple-700'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-purple-200'
                                }`}
                        >
                            <div className="font-bold text-sm">Full-Auto</div>
                            <div className="text-xs opacity-70">Complete automatically</div>
                        </button>
                    </div>
                </div>

                {/* Prompt Preview */}
                {universityName && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                <FileText className="w-3 h-3" /> Generated Prompt
                            </label>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowPromptPreview(!showPromptPreview)}
                                    className="text-xs text-purple-500 hover:underline flex items-center gap-1"
                                >
                                    <Eye className="w-3 h-3" />
                                    {showPromptPreview ? 'Hide' : 'Show'}
                                </button>
                                <button
                                    onClick={handleCopyPrompt}
                                    className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${copiedPrompt
                                        ? 'bg-green-100 text-green-600'
                                        : 'bg-slate-100 text-slate-500 hover:bg-purple-100 hover:text-purple-600'
                                        }`}
                                >
                                    {copiedPrompt ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                    {copiedPrompt ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                        </div>

                        {showPromptPreview && (
                            <div className="bg-slate-900 rounded-xl p-4 max-h-48 overflow-y-auto">
                                <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                                    {generatedPrompt}
                                </pre>
                            </div>
                        )}
                    </div>
                )}

                {/* Batch Queue */}
                {batchMode && applicationQueue.length > 0 && (
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Application Queue ({applicationQueue.length})</label>
                        <div className="space-y-1.5">
                            {applicationQueue.map(app => (
                                <div key={app.id} className="flex items-center justify-between bg-slate-50 rounded-lg p-2.5">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${app.status === 'completed' ? 'bg-green-500' :
                                            app.status === 'running' ? 'bg-purple-500 animate-pulse' :
                                                app.status === 'error' ? 'bg-red-500' :
                                                    'bg-slate-300'
                                            }`} />
                                        <span className="text-sm font-medium text-slate-700">{app.student.full_name}</span>
                                        <span className="text-xs text-slate-400">→</span>
                                        <span className="text-sm text-slate-500">{app.university}</span>
                                    </div>
                                    <button
                                        onClick={() => removeFromQueue(app.id)}
                                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                    {batchMode && (
                        <button
                            onClick={addToQueue}
                            disabled={!universityName}
                            className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <Plus className="w-4 h-4" /> Add to Queue
                        </button>
                    )}

                    <button
                        onClick={startAutomation}
                        disabled={isAutomating || !universityName || !geminiApiKey || serviceStatus !== 'running'}
                        className="flex-1 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    >
                        {isAutomating ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Running...</>
                        ) : (
                            <><Play className="w-5 h-5" /> Start Automation</>
                        )}
                    </button>
                </div>

                {/* Progress Display */}
                {automationProgress && (
                    <div className={`p-4 rounded-xl ${automationProgress.status === 'error' ? 'bg-red-50 border border-red-200' :
                        automationProgress.status === 'completed' ? 'bg-green-50 border border-green-200' :
                            'bg-slate-50 border border-slate-200'
                        }`}>
                        <div className="flex items-center gap-2 mb-2">
                            {automationProgress.status === 'error' ? (
                                <AlertCircle className="w-5 h-5 text-red-500" />
                            ) : automationProgress.status === 'completed' ? (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : (
                                <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
                            )}
                            <span className="font-bold text-sm capitalize">{automationProgress.status}</span>
                        </div>
                        <p className="text-sm text-slate-600">{automationProgress.message}</p>

                        {/* Progress Bar */}
                        {automationProgress.progress > 0 && (
                            <div className="mt-3 h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                                    style={{ width: `${automationProgress.progress}%` }}
                                />
                            </div>
                        )}

                        {/* Account Credentials */}
                        {automationProgress.account_credentials && (
                            <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200">
                                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Portal Account Created</p>
                                <p className="text-sm"><strong>Email:</strong> {automationProgress.account_credentials.email}</p>
                                <p className="text-sm"><strong>Password:</strong> {automationProgress.account_credentials.password}</p>
                            </div>
                        )}

                        {/* Confirm Buttons for Semi-Auto */}
                        {automationProgress.status === 'awaiting_confirmation' && (
                            <div className="mt-3 flex gap-2">
                                <button
                                    onClick={() => confirmSubmission('submit')}
                                    className="flex-1 py-2 bg-green-500 text-white rounded-lg font-bold text-sm"
                                >
                                    ✓ Submit Application
                                </button>
                                <button
                                    onClick={() => confirmSubmission('cancel')}
                                    className="flex-1 py-2 bg-red-500 text-white rounded-lg font-bold text-sm"
                                >
                                    ✗ Cancel
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Help Text */}
                {serviceStatus === 'stopped' && (
                    <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-700">
                        <strong>Service not running.</strong> The automation service should start automatically with the app.
                        If not, restart the application.
                    </div>
                )}
            </div>
        </div>
    );
}
