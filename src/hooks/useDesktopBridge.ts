/**
 * Desktop Bridge Hook
 * 
 * Provides access to Electron desktop features when running in the desktop app.
 * Falls back gracefully when running in a regular browser.
 * 
 * @file src/hooks/useDesktopBridge.ts
 */

import { useEffect, useState, useCallback } from 'react';
import type { ElectronAPI } from '@/types/global';

export interface AgentLog {
    type: 'stdout' | 'stderr';
    message: string;
    timestamp: Date;
}

export function useDesktopBridge() {
    const [isDesktop, setIsDesktop] = useState(false);
    const [isAgentRunning, setIsAgentRunning] = useState(false);
    const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);

    // Check if running in desktop app
    useEffect(() => {
        if (typeof window !== 'undefined' && window.electron?.isDesktop) {
            setIsDesktop(true);
            console.log('[DesktopBridge] Running in Electron desktop app');
        }
    }, []);

    // Subscribe to agent logs
    useEffect(() => {
        if (!isDesktop || !window.electron) return;

        const cleanup = window.electron.onAgentLog((data) => {
            setAgentLogs((prev) => [
                ...prev,
                { ...data, timestamp: new Date() },
            ]);
        });

        return cleanup;
    }, [isDesktop]);

    // Run the automation agent
    const runAgent = useCallback(async (studentProfile: any, universityUrl?: string) => {
        if (!isDesktop || !window.electron) {
            throw new Error('Desktop app required for automation');
        }

        setIsAgentRunning(true);
        setAgentLogs([]);

        try {
            const result = await window.electron.runAgent(studentProfile, universityUrl);
            return result;
        } finally {
            setIsAgentRunning(false);
        }
    }, [isDesktop]);

    // Stop the running agent
    const stopAgent = useCallback(async () => {
        if (!isDesktop || !window.electron) return;

        const result = await window.electron.stopAgent();
        setIsAgentRunning(false);
        return result;
    }, [isDesktop]);

    // Clear logs
    const clearLogs = useCallback(() => {
        setAgentLogs([]);
    }, []);

    return {
        isDesktop,
        isAgentRunning,
        agentLogs,
        runAgent,
        stopAgent,
        clearLogs,
    };
}
