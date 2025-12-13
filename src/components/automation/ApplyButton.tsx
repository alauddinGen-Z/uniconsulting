/**
 * Automation Apply Button Component
 * 
 * Shows "Apply with AI" button that uses the desktop app for automation,
 * or prompts users to download the desktop app if running in browser.
 * 
 * @file src/components/automation/ApplyButton.tsx
 */

"use client";

import { useState } from 'react';
import { Sparkles, Download, Loader2, Terminal, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { useDesktopBridge } from '@/hooks/useDesktopBridge';

interface ApplyButtonProps {
    student: {
        id: string;
        full_name?: string;
        email?: string;
        [key: string]: any;
    };
    universityName?: string;
    onSuccess?: () => void;
    onError?: (error: string) => void;
}

export default function ApplyButton({ student, universityName, onSuccess, onError }: ApplyButtonProps) {
    const { isDesktop, isAgentRunning, agentLogs, runAgent, stopAgent, clearLogs } = useDesktopBridge();
    const [showLogs, setShowLogs] = useState(false);
    const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');

    const handleApply = async () => {
        if (!isDesktop) {
            // Show download prompt for browser users
            const shouldDownload = confirm(
                '🖥️ Desktop App Required\n\n' +
                'Automated form filling requires the UniConsulting Desktop App.\n\n' +
                'Would you like to download it now?'
            );

            if (shouldDownload) {
                window.open('/desktop-download', '_blank');
            }
            return;
        }

        // Run automation
        setStatus('running');
        setShowLogs(true);
        clearLogs();

        try {
            const result = await runAgent(student);

            if (result.success) {
                setStatus('success');
                onSuccess?.();
            } else {
                setStatus('error');
                onError?.(result.error || 'Automation failed');
            }
        } catch (error: any) {
            setStatus('error');
            onError?.(error.message || 'Unknown error');
        }
    };

    const handleStop = async () => {
        await stopAgent();
        setStatus('idle');
    };

    return (
        <div className="relative">
            {/* Main Button */}
            <button
                onClick={handleApply}
                disabled={isAgentRunning}
                className={`
          flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all
          ${isDesktop
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/25'
                        : 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600'
                    }
          ${isAgentRunning ? 'opacity-75 cursor-not-allowed' : ''}
        `}
            >
                {isAgentRunning ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Running...
                    </>
                ) : isDesktop ? (
                    <>
                        <Sparkles className="w-4 h-4" />
                        ✨ Apply with AI
                    </>
                ) : (
                    <>
                        <Download className="w-4 h-4" />
                        Download Desktop App
                    </>
                )}
            </button>

            {/* Logs Panel */}
            {showLogs && (
                <div className="absolute top-full mt-2 right-0 w-96 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50">
                    {/* Header */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
                        <div className="flex items-center gap-2">
                            <Terminal className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-medium text-slate-300">Agent Logs</span>
                            {status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                            {status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                        </div>
                        <div className="flex items-center gap-2">
                            {isAgentRunning && (
                                <button
                                    onClick={handleStop}
                                    className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                                >
                                    Stop
                                </button>
                            )}
                            <button
                                onClick={() => setShowLogs(false)}
                                className="p-1 hover:bg-slate-800 rounded"
                            >
                                <X className="w-4 h-4 text-slate-400" />
                            </button>
                        </div>
                    </div>

                    {/* Logs */}
                    <div className="h-64 overflow-y-auto p-3 font-mono text-xs">
                        {agentLogs.length === 0 ? (
                            <p className="text-slate-500">Waiting for logs...</p>
                        ) : (
                            agentLogs.map((log, index) => (
                                <div
                                    key={index}
                                    className={`mb-1 ${log.type === 'stderr' ? 'text-red-400' : 'text-green-400'}`}
                                >
                                    <span className="text-slate-500">
                                        {log.timestamp.toLocaleTimeString()}
                                    </span>{' '}
                                    {log.message}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
