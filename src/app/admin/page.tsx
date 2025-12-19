"use client";

import { Building2, Users, GraduationCap, TrendingUp, AlertCircle } from "lucide-react";

export default function AdminDashboard() {
    return (
        <div className="p-8 space-y-8">
            <header>
                <h1 className="text-3xl font-black text-slate-900">Platform Overview</h1>
                <p className="text-slate-500">Global statistics across all tenants</p>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-4">
                        <Building2 className="w-6 h-6" />
                    </div>
                    <div className="text-2xl font-black text-slate-900">12</div>
                    <div className="text-sm text-slate-500 font-medium">Active Agencies</div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 mb-4">
                        <GraduationCap className="w-6 h-6" />
                    </div>
                    <div className="text-2xl font-black text-slate-900">458</div>
                    <div className="text-sm text-slate-500 font-medium">Total Students</div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 mb-4">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <div className="text-2xl font-black text-slate-900">$4,250</div>
                    <div className="text-sm text-slate-500 font-medium">Monthly Revenue (MRR)</div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mb-4">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="text-2xl font-black text-slate-900">2</div>
                    <div className="text-sm text-slate-500 font-medium">Pending Approvals</div>
                </div>
            </div>

            {/* Recent Activity / System Logs */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 text-lg">System Health</h3>
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full uppercase">All Systems Nominal</span>
                </div>
                <div className="p-6">
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="flex items-center gap-4 py-3 border-b border-slate-50 last:border-0">
                                <div className="w-2 h-2 rounded-full bg-slate-200" />
                                <div className="flex-1">
                                    <p className="text-sm text-slate-900 font-medium">Agency "Global Compass" processed 15 new applications.</p>
                                    <p className="text-xs text-slate-400">2 hours ago</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
