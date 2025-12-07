"use client";

import { FolderOpen } from "lucide-react";
import DocumentsPage from "./DocumentsPage";

interface DocumentsTabPageProps {
    isLocked?: boolean;
}

export default function DocumentsTabPage({ isLocked }: DocumentsTabPageProps) {
    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
                    <FolderOpen className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Documents</h2>
                    <p className="text-slate-400 text-sm">Upload and manage your documents</p>
                </div>
            </div>

            {/* Documents Section */}
            <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
                <DocumentsPage isLocked={isLocked} />
            </div>
        </div>
    );
}
