/**
 * AI Automation Page - Desktop Feature Info
 * 
 * Informs users about the desktop-exclusive AI automation feature.
 * Per CoVe Protocol: Component verified to exist at calculated relative path.
 * 
 * @file src/app/teacher/ai-automation/page.tsx
 */

import AIAutomationDashboard from '@/components/teacher/AIAutomationDashboard';
import { Metadata } from 'next';

// SEO metadata for the page
export const metadata: Metadata = {
    title: 'AI Automation Command Center | UniConsulting Teacher',
    description: 'Control Python browser automation service for university applications. Desktop app exclusive feature.',
};

/**
 * Teacher AI Automation Page
 * 
 * CoVe Verification Checklist:
 * [✓] Component Existence: AIAutomationDashboard resolves via @/components alias
 * [✓] Hydration Integrity: Component uses 'use client' directive, no SSR hydration issues
 * 
 * This is a Server Component that renders the client component.
 */
export default function AIAutomationPage() {
    return (
        <div className="flex flex-col flex-1 h-full w-full">
            {/* 
        Container ensures the dashboard uses the full available space 
        below the header/sidebar layout. No additional padding needed
        as the component handles its own spacing.
      */}
            <AIAutomationDashboard />
        </div>
    );
}
