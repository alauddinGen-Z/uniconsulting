/**
 * AutoApplyPanel Component
 * Panel for AI-powered university application automation using browser-use
 */

import { useState, useEffect, useRef } from 'react';
import {
    Bot, Play, CheckCircle, AlertCircle, Key,
    ExternalLink, Loader2, GraduationCap
} from 'lucide-react';

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
    nationality?: string;
    passport_number?: string;
    home_address?: string;
    gpa?: string;
    sat_total?: string;
    ielts_overall?: string;
    toefl_total?: string;
    preferred_major?: string;
    father_name?: string;
    mother_name?: string;
}

interface AutoApplyPanelProps {
    studentData: StudentData | null;
}

export default function AutoApplyPanel({ studentData }: AutoApplyPanelProps) {
    const [universityName, setUniversityName] = useState('');
    const [automationMode, setAutomationMode] = useState<'semi' | 'full'>('semi');
    const [isAutomating, setIsAutomating] = useState(false);
    const [automationProgress, setAutomationProgress] = useState<AutomationProgress | null>(null);
    const [automationTaskId, setAutomationTaskId] = useState<string | null>(null);
    const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
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

    // Save API key
    const saveApiKey = (key: string) => {
        setGeminiApiKey(key);
        localStorage.setItem('gemini_api_key', key);
        setShowApiKeyInput(false);
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
                    mode: automationMode,
                    gemini_api_key: geminiApiKey
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
                setAutomationProgress({ status: 'error', progress: 0, message: 'Connection failed' });
                setIsAutomating(false);
            };
        } catch (error) {
            setAutomationProgress({ status: 'error', progress: 0, message: `Failed: ${error}` });
            setIsAutomating(false);
        }
    };

    // Confirm submission
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
            </div>
        );
    }

    return (
        <div className="p-5 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                        <Bot className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900">Auto-Apply</h3>
                        <p className="text-xs text-slate-500">AI-powered form filling</p>
                    </div>
                </div>

                {/* Service Status */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${serviceStatus === 'running' ? 'bg-green-100 text-green-700' :
                    serviceStatus === 'stopped' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-500'
                    }`}>
                    <div className={`w-2 h-2 rounded-full ${serviceStatus === 'running' ? 'bg-green-500 animate-pulse' :
                        serviceStatus === 'stopped' ? 'bg-red-500' : 'bg-slate-400'
                        }`} />
                    {serviceStatus === 'running' ? 'Ready' : serviceStatus === 'stopped' ? 'Service Offline' : '...'}
                </div>
            </div>

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
                        <button onClick={() => saveApiKey(geminiApiKey)} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-bold">Save</button>
                        <button onClick={() => setShowApiKeyInput(false)} className="px-4 py-2 bg-slate-200 text-slate-600 rounded-lg text-sm">Cancel</button>
                        <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-orange-500 hover:underline flex items-center gap-1">
                            Get Key <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                </div>
            )}

            {/* University Input */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase">University Name</label>
                <div className="relative">
                    <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        value={universityName}
                        onChange={(e) => setUniversityName(e.target.value)}
                        placeholder="e.g. Harvard, MIT, Stanford..."
                        disabled={isAutomating}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300 outline-none"
                    />
                </div>
            </div>

            {/* Mode Selection */}
            <div className="space-y-2">
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
                        <div className="text-xs opacity-70">Submit automatically</div>
                    </button>
                </div>
            </div>

            {/* Start Button */}
            <button
                onClick={startAutomation}
                disabled={isAutomating || !universityName || !geminiApiKey || serviceStatus !== 'running'}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
                {isAutomating ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Running...</>
                ) : (
                    <><Play className="w-5 h-5" /> Start Automation</>
                )}
            </button>

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
                    <strong>Service not running.</strong> Start the automation service:
                    <code className="block mt-1 p-2 bg-amber-100 rounded">automation-service\start.bat</code>
                </div>
            )}
        </div>
    );
}
