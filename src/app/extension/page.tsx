/**
 * Extension Download Page
 * 
 * Allows users to download the AdmitAI Agent extension for Chrome or Edge
 * 
 * @file src/app/extension/page.tsx
 */

import { Download, Chrome, Globe, CheckCircle2, Sparkles, Shield, Zap } from "lucide-react";
import Link from "next/link";

export default function ExtensionDownloadPage() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
            {/* Header */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="text-xl font-bold text-orange-500">
                        UniConsulting
                    </Link>
                    <Link
                        href="/login"
                        className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 font-medium transition-colors"
                    >
                        Login
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-16 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-6">
                        <Sparkles className="w-4 h-4" />
                        Browser Extension
                    </div>

                    <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
                        <span className="bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">
                            AdmitAI Agent
                        </span>
                    </h1>

                    <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto">
                        Automatically fill university application forms with your profile data using AI-powered field mapping
                    </p>

                    {/* Download Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                        <a
                            href="/admitai-chrome.zip"
                            download
                            className="group flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 font-bold text-lg transition-all shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-0.5"
                        >
                            <Chrome className="w-6 h-6" />
                            Download for Chrome
                            <Download className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
                        </a>

                        <a
                            href="/admitai-edge.zip"
                            download
                            className="group flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-lg transition-all border border-slate-600"
                        >
                            <Globe className="w-6 h-6" />
                            Download for Edge
                            <Download className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
                        </a>
                    </div>

                    <p className="text-sm text-slate-500">
                        Version 0.0.1 • Works with Manifest V3
                    </p>
                </div>
            </section>

            {/* Features */}
            <section className="py-16 px-6">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-2xl font-bold text-center mb-12">Key Features</h2>
                    <div className="grid md:grid-cols-3 gap-6">
                        <FeatureCard
                            icon={<Zap className="w-6 h-6" />}
                            title="One-Click Auto-Fill"
                            description="Fill entire application forms with a single click using AI"
                        />
                        <FeatureCard
                            icon={<Shield className="w-6 h-6" />}
                            title="Secure Token Handoff"
                            description="Seamlessly sync your login from the web app to the extension"
                        />
                        <FeatureCard
                            icon={<Sparkles className="w-6 h-6" />}
                            title="AI-Powered Mapping"
                            description="Uses Gemini 2.0 Flash to intelligently match fields to your data"
                        />
                    </div>
                </div>
            </section>

            {/* Installation Instructions */}
            <section className="py-16 px-6 bg-slate-800/50">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-2xl font-bold text-center mb-12">How to Install</h2>

                    <div className="space-y-6">
                        <Step number={1} title="Download the extension">
                            Click the download button above for your browser (Chrome or Edge)
                        </Step>

                        <Step number={2} title="Extract the ZIP file">
                            Extract the downloaded ZIP file to a folder on your computer
                        </Step>

                        <Step number={3} title="Open extensions page">
                            <span className="font-mono text-orange-400">chrome://extensions</span> (Chrome) or{" "}
                            <span className="font-mono text-orange-400">edge://extensions</span> (Edge)
                        </Step>

                        <Step number={4} title="Enable Developer Mode">
                            Toggle the &quot;Developer mode&quot; switch in the top-right corner
                        </Step>

                        <Step number={5} title="Load the extension">
                            Click &quot;Load unpacked&quot; and select the extracted folder
                        </Step>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-8 px-6 border-t border-white/5">
                <div className="max-w-6xl mx-auto text-center text-slate-500 text-sm">
                    <p>© 2024 UniConsulting. All rights reserved.</p>
                </div>
            </footer>
        </main>
    );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400 mb-4">
                {icon}
            </div>
            <h3 className="font-bold mb-2">{title}</h3>
            <p className="text-slate-400 text-sm">{description}</p>
        </div>
    );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
    return (
        <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center font-bold">
                {number}
            </div>
            <div>
                <h3 className="font-bold mb-1">{title}</h3>
                <p className="text-slate-400">{children}</p>
            </div>
        </div>
    );
}
