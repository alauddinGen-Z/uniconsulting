/**
 * AIAutomationDashboard - Desktop App Feature Indicator
 * 
 * This component informs users that AI browser automation is available
 * exclusively in the desktop application.
 * 
 * @file src/components/teacher/AIAutomationDashboard.tsx
 */

'use client';

import { Terminal, Download, Zap, CheckCircle, ArrowRight } from 'lucide-react';

export default function AIAutomationDashboard() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[600px] p-8">
            {/* Feature Card */}
            <div className="max-w-2xl w-full bg-gradient-to-br from-purple-50 to-indigo-50 rounded-3xl p-8 border-2 border-purple-200 shadow-xl">
                {/* Icon */}
                <div className="flex justify-center mb-6">
                    <div className="w-20 h-20 bg-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
                        <Terminal className="w-10 h-10 text-white" />
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-3xl font-black text-center text-slate-900 mb-3">
                    AI Browser Automation
                </h1>
                <p className="text-center text-slate-600 mb-6 text-lg">
                    Powered by Python + Google Gemini AI
                </p>

                {/* Features List */}
                <div className="bg-white rounded-2xl p-6 mb-6 space-y-3">
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-orange-500" />
                        Desktop-Exclusive Features
                    </h3>

                    <FeatureItem text="Automated form filling with AI agent" />
                    <FeatureItem text="Real-time browser control & navigation" />
                    <FeatureItem text="Natural language task commands" />
                    <FeatureItem text="Live terminal feed with agent logs" />
                    <FeatureItem text="Preset actions for common tasks" />
                </div>

                {/* Notice Box */}
                <div className="bg-purple-100 border-2 border-purple-300 rounded-2xl p-4 mb-6">
                    <p className="text-sm text-purple-900 text-center font-medium">
                        <strong>📱 Desktop App Only:</strong> This feature requires the
                        UniConsulting Teacher Desktop Application with Python automation engine.
                    </p>
                </div>

                {/* Download CTA */}
                <div className="flex flex-col items-center gap-3">
                    <a
                        href="/downloads/uniconsulting-teacher-setup.exe"
                        className="flex items-center gap-3 px-8 py-4 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                        <Download className="w-5 h-5" />
                        Download Desktop App
                        <ArrowRight className="w-5 h-5" />
                    </a>
                    <p className="text-xs text-slate-500 text-center max-w-md">
                        The desktop app includes the Python automation service,
                        Google Gemini AI integration, and browser control capabilities.
                    </p>
                </div>
            </div>

            {/* Alternative: Web App Automation */}
            <div className="mt-8 text-center">
                <p className="text-slate-500 mb-2">
                    Looking for data copying automation?
                </p>
                <a
                    href="/teacher/automation"
                    className="text-orange-600 hover:text-orange-700 font-semibold underline"
                >
                    Use Web App Automation Hub →
                </a>
            </div>
        </div>
    );
}

function FeatureItem({ text }: { text: string }) {
    return (
        <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span className="text-slate-700">{text}</span>
        </div>
    );
}
