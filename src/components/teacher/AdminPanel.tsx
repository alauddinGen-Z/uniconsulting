"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { Loader2, UserPlus, Trash2, Shield, Users, Mail, User, RefreshCw } from "lucide-react";

interface Teacher {
    id: string;
    email: string;
    full_name: string;
    is_admin: boolean;
    created_at: string;
}

export default function AdminPanel() {
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newTeacher, setNewTeacher] = useState({ email: "", full_name: "", password: "" });
    const supabase = createClient();

    const fetchTeachers = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, email, full_name, is_admin, created_at')
                .eq('role', 'teacher')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setTeachers(data || []);
        } catch (error: any) {
            toast.error("Failed to load teachers: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTeachers();
    }, []);

    const handleAddTeacher = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTeacher.email || !newTeacher.full_name || !newTeacher.password) {
            toast.error("Please fill in all fields");
            return;
        }

        setIsAdding(true);
        try {
            const response = await fetch('/api/admin/add-teacher', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTeacher)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to add teacher');
            }

            toast.success("Teacher added successfully!");
            setNewTeacher({ email: "", full_name: "", password: "" });
            setShowAddForm(false);
            fetchTeachers();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteTeacher = async (teacherId: string, teacherEmail: string) => {
        if (!confirm(`Are you sure you want to remove ${teacherEmail}?`)) return;

        try {
            // Note: Full deletion requires admin API - for now we can only remove from profiles
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', teacherId);

            if (error) throw error;

            toast.success("Teacher removed successfully");
            fetchTeachers();
        } catch (error: any) {
            toast.error("Failed to remove teacher: " + error.message);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black font-montserrat text-slate-900 flex items-center gap-3">
                        <Shield className="w-8 h-8 text-purple-500" />
                        ADMIN PANEL
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">
                        Manage teacher accounts and permissions
                    </p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={fetchTeachers}
                        className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="btn-primary flex items-center gap-2 px-6 shadow-lg shadow-orange-500/20"
                    >
                        <UserPlus className="w-5 h-5" />
                        Add Teacher
                    </button>
                </div>
            </div>

            {/* Stats Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                            <Users className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-slate-900">{teachers.length}</p>
                            <p className="text-sm text-slate-500 font-medium">Total Teachers</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                            <Shield className="w-6 h-6 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-slate-900">
                                {teachers.filter(t => t.is_admin).length}
                            </p>
                            <p className="text-sm text-slate-500 font-medium">Admin Users</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                            <User className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-slate-900">
                                {teachers.filter(t => !t.is_admin).length}
                            </p>
                            <p className="text-sm text-slate-500 font-medium">Regular Teachers</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Teachers List */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-900">Teacher Accounts</h2>
                </div>

                {isLoading ? (
                    <div className="p-12 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                    </div>
                ) : teachers.length === 0 ? (
                    <div className="p-12 text-center">
                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">No teachers found. Add your first teacher!</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {teachers.map((teacher) => (
                            <div
                                key={teacher.id}
                                className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg
                                        ${teacher.is_admin ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-600'}`}>
                                        {teacher.full_name?.charAt(0) || teacher.email.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-slate-900">
                                                {teacher.full_name || "Unnamed"}
                                            </p>
                                            {teacher.is_admin && (
                                                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 text-xs font-bold flex items-center gap-1">
                                                    <Shield className="w-3 h-3" />
                                                    Admin
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-500 flex items-center gap-1">
                                            <Mail className="w-3 h-3" />
                                            {teacher.email}
                                        </p>
                                    </div>
                                </div>

                                {!teacher.is_admin && (
                                    <button
                                        onClick={() => handleDeleteTeacher(teacher.id, teacher.email || '')}
                                        className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                                        title="Remove teacher"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Teacher Modal */}
            {showAddForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddForm(false)} />
                    <div className="relative bg-white rounded-2xl p-6 shadow-2xl max-w-md w-full animate-in zoom-in-95 fade-in">
                        <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                            <UserPlus className="w-6 h-6 text-orange-500" />
                            Add New Teacher
                        </h3>
                        <p className="text-slate-500 text-sm mb-6">
                            Create a new teacher account. They will be able to manage their own students.
                        </p>

                        <form onSubmit={handleAddTeacher} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                                <input
                                    type="text"
                                    value={newTeacher.full_name}
                                    onChange={(e) => setNewTeacher({ ...newTeacher, full_name: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
                                    placeholder="Jane Doe"
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                                <input
                                    type="email"
                                    value={newTeacher.email}
                                    onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
                                    placeholder="teacher@example.com"
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Temporary Password</label>
                                <input
                                    type="password"
                                    value={newTeacher.password}
                                    onChange={(e) => setNewTeacher({ ...newTeacher, password: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
                                    placeholder="••••••••"
                                    minLength={6}
                                    required
                                />
                                <p className="text-[10px] text-slate-400">Min 6 characters. Teacher can change this later.</p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAddForm(false)}
                                    className="flex-1 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isAdding}
                                    className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                    Add Teacher
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
