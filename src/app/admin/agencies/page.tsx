"use client";

import { Plus, Search, MoreHorizontal, ExternalLink, Shield } from "lucide-react";

const AGENCIES = [
    { id: '1', name: 'Global Compass', domain: 'globalcompass.kg', students: 120, status: 'Active', plan: 'Enterprise' },
    { id: '2', name: 'UniConsult Bishkek', domain: 'ub.edu.kg', students: 45, status: 'Active', plan: 'Pro' },
    { id: '3', name: 'Elite Education', domain: 'elite-edu.com', students: 12, status: 'Trial', plan: 'Starter' },
];

export default function AgenciesPage() {
    return (
        <div className="p-8 space-y-8">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900">Agencies</h1>
                    <p className="text-slate-500">Manage all consulting firms on the platform</p>
                </div>
                <button className="btn-primary flex items-center gap-2 px-6 py-3 rounded-2xl bg-orange-500 text-white font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20">
                    <Plus className="w-5 h-5" />
                    Add New Agency
                </button>
            </header>

            {/* Filters */}
            <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search agencies by name or domain..."
                        className="w-full pl-12 pr-4 py-2 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                </div>
                <select className="bg-slate-50 border-0 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-orange-500">
                    <option>All Status</option>
                    <option>Active</option>
                    <option>Trial</option>
                    <option>Suspended</option>
                </select>
            </div>

            {/* Agencies Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Agency Name</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Domain</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Students</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Plan</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {AGENCIES.map((agency) => (
                            <tr key={agency.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-600">
                                            {agency.name.charAt(0)}
                                        </div>
                                        <span className="font-bold text-slate-900">{agency.name}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500 font-medium">{agency.domain}</td>
                                <td className="px-6 py-4 text-sm text-slate-900 font-bold">{agency.students}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${agency.plan === 'Enterprise' ? 'bg-purple-100 text-purple-700' :
                                            agency.plan === 'Pro' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                                        }`}>
                                        {agency.plan}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`flex items-center gap-1.5 text-sm font-medium ${agency.status === 'Active' ? 'text-green-600' : 'text-orange-500'
                                        }`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${agency.status === 'Active' ? 'bg-green-600' : 'bg-orange-500'
                                            }`} />
                                        {agency.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="p-2 hover:bg-white rounded-lg border border-slate-200 text-slate-400 hover:text-orange-600">
                                            <ExternalLink className="w-4 h-4" />
                                        </button>
                                        <button className="p-2 hover:bg-white rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600">
                                            <MoreHorizontal className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
