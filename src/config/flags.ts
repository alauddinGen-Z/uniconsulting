"use client";

/**
 * Feature Flags Configuration
 * 
 * Controls which features are available based on APP_MODE.
 * - 'student': Lightweight version without automation
 * - 'teacher': Full version with Python automation
 * - 'full': Web version with all features
 * 
 * @file src/config/flags.ts
 */

// Determine app mode from environment or window object (for Electron)
function getAppMode(): 'student' | 'teacher' | 'full' {
    // Check Next.js environment variable first
    if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_MODE) {
        return process.env.NEXT_PUBLIC_APP_MODE as 'student' | 'teacher' | 'full';
    }

    // Check if running in Electron with app mode metadata
    if (typeof window !== 'undefined' && (window as any).electronAppMode) {
        return (window as any).electronAppMode;
    }

    // Default to full for web version
    return 'full';
}

export const APP_MODE = getAppMode();

/**
 * Feature flags based on app mode
 */
export const features = {
    /**
     * Automation Hub - Python-powered form filling
     * Only available in teacher mode
     */
    automationHub: APP_MODE === 'teacher' || APP_MODE === 'full',

    /**
     * Teacher Command Center - Student management
     * Hidden for student-only builds
     */
    teacherCommandCenter: APP_MODE !== 'student',

    /**
     * Python Engine - browser-use automation
     * Only bundled in teacher version
     */
    pythonEngine: APP_MODE === 'teacher',

    /**
     * AI Features - Essay review, OCR, University matcher
     * Available in all versions (calls remote API)
     */
    aiFeatures: true,

    /**
     * Student Portal - Profile, documents, essays
     * Available in all versions
     */
    studentPortal: true,

    /**
     * Real-time Chat
     * Available in all versions
     */
    chat: true,
};

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(feature: keyof typeof features): boolean {
    return features[feature];
}

/**
 * Get display name for current app mode
 */
export function getAppModeName(): string {
    switch (APP_MODE) {
        case 'student':
            return 'Student Edition';
        case 'teacher':
            return 'Teacher Edition';
        default:
            return 'UniConsulting';
    }
}
