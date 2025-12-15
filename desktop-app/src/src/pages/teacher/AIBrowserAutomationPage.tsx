/**
 * AI Browser Automation Page - Desktop App
 * 
 * Full AI-powered browser automation dashboard with Gemini integration.
 * Connects to the Python FastAPI automation service on port 8765.
 * 
 * @file desktop-app/src/src/pages/teacher/AIBrowserAutomationPage.tsx
 */

import AIAutomationDashboard from '../../components/AIAutomationDashboard';

export default function AIBrowserAutomationPage() {
    return (
        <div className="h-full w-full overflow-hidden">
            <AIAutomationDashboard />
        </div>
    );
}
