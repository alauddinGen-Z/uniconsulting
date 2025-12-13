/**
 * Auto-Apply Button Component
 * 
 * Detects if running in Electron desktop app and shows appropriate button:
 * - Desktop Mode: "🚀 Launch Auto-Pilot" - triggers local Python automation
 * - Web Mode: "Download Desktop App" - links to download page
 * 
 * @file src/components/dashboard/AutoApplyButton.tsx
 */

"use client";

import { useState } from 'react';
import { Rocket, Download, Loader2, CheckCircle2, XCircle, Terminal, X } from 'lucide-react';

interface AutoApplyButtonProps {
    student: {
        id: string;
        full_name?: string;
        email?: string;
        [key: string]: any;
    };
    universityName?: string;
    className?: string;
}

interface LogEntry {
    type: 'stdout' | 'stderr';
    message: string;
    timestamp: Date;
}

export default function AutoApplyButton({ student, universityName, className = '' }: AutoApplyButtonProps) {
    const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [showLogs, setShowLogs] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Check if running in Electron desktop app
    const isDesktop = typeof window !== 'undefined' && window.electron?.isDesktop;

    const handleLaunchAutoPilot = async () => {
        if (!window.electron) return;

        setStatus('running');
        setShowLogs(true);
        setLogs([]);
        setErrorMessage('');

        // Subscribe to engine logs
        const cleanup = window.electron.onAgentLog((data) => {
            setLogs((prev) => [...prev, { ...data, timestamp: new Date() }]);
        });

        try {
            const result = await window.electron.runAgent(student);

            if (result.success) {
                setStatus('success');
                setLogs((prev) => [...prev, {
                    type: 'stdout',
                    message: '✅ Auto-pilot completed successfully!',
                    timestamp: new Date()
                }]);
            } else {
                setStatus('error');
                setErrorMessage(result.error || 'Unknown error');
            }
        } catch (error: any) {
            setStatus('error');
            setErrorMessage(error.message || 'Failed to run agent');
        }

        cleanup();
    };

    const handleStop = async () => {
        if (!window.electron) return;
        await window.electron.stopAgent();
        setStatus('idle');
        setLogs((prev) => [...prev, {
            type: 'stderr',
            message: '⚠️ Agent stopped by user',
            timestamp: new Date()
        }]);
    };

    const handleDownloadDesktop = () => {
        // Link to desktop download page or show modal
        window.open('https://github.com/alauddinGen-Z/uniconsulting/releases', '_blank');
    };

    // Desktop Mode - Show Auto-Pilot Button
    if (isDesktop) {
        return (
            <div className={`relative ${className}`}>
                <button
                    onClick={handleLaunchAutoPilot}
                    disabled={status === 'running'}
                    className={`
            flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white
            transition-all duration-200 shadow-lg
            ${status === 'running'
                            ? 'bg-orange-600 cursor-not-allowed'
                            : status === 'success'
                                ? 'bg-green-500 hover:bg-green-600'
                                : status === 'error'
                                    ? 'bg-red-500 hover:bg-red-600'
                                    : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 hover:shadow-xl hover:-translate-y-0.5'
                        }
          `}
                >
                    {status === 'running' ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Running Auto-Pilot...
                        </>
                    ) : status === 'success' ? (
                        <>
                            <CheckCircle2 className="w-5 h-5" />
                            Completed!
                        </>
                    ) : status === 'error' ? (
                        <>
                            <XCircle className="w-5 h-5" />
                            Failed - Click to Retry
                        </>
                    ) : (
                        <>
                            <Rocket className="w-5 h-5" />
                            🚀 Launch Auto-Pilot
                        </>
                    )}
                </button>

                {/* Logs Panel */}
                {showLogs && (
                    <div className="absolute top-full mt-2 right-0 w-[400px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
                            <div className="flex items-center gap-2">
                                <Terminal className="w-4 h-4 text-purple-400" />
                                <span className="font-bold text-white">Auto-Pilot Logs</span>
                                {universityName && (
                                    <span className="text-xs text-slate-400">• {universityName}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {status === 'running' && (
                                    <button
                                        onClick={handleStop}
                                        className="px-3 py-1 text-xs font-bold bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                                    >
                                        Stop
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowLogs(false)}
                                    className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
                                >
                                    <X className="w-4 h-4 text-slate-400" />
                                </button>
                            </div>
                        </div>

                        {/* Logs Content */}
                        <div className="h-64 overflow-y-auto p-4 font-mono text-xs space-y-1">
                            {logs.length === 0 ? (
                                <p className="text-slate-500 text-center py-4">
                                    {status === 'running' ? 'Starting engine...' : 'No logs yet'}
                                </p>
                            ) : (
                                logs.map((log, index) => (
                                    <div
                                        key={index}
                                        className={`${log.type === 'stderr' ? 'text-red-400' : 'text-green-400'}`}
                                    >
                                        <span className="text-slate-500 mr-2">
                                            {log.timestamp.toLocaleTimeString()}
                                        </span>
                                        {log.message}
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Error Display */}
                        {errorMessage && (
                            <div className="px-4 py-3 bg-red-500/10 border-t border-red-500/20 text-red-400 text-sm">
                                <strong>Error:</strong> {errorMessage}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // Web Mode - Show Download Button
    return (
        <button
            onClick={handleDownloadDesktop}
            className={`
        flex items-center gap-2 px-6 py-3 rounded-xl font-bold
        bg-slate-700 text-white hover:bg-slate-600
        border border-slate-600 hover:border-slate-500
        transition-all duration-200
        ${className}
      `}
        >
            <Download className="w-5 h-5" />
            Download Desktop App
        </button>
    );
}
