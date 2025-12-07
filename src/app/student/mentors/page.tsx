"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Search, MapPin, Star, Clock, ArrowRight } from "lucide-react";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { motion } from "framer-motion";

interface Teacher {
    id: string;
    full_name: string;
    bio: string;
    expertise: string[];
    hourly_rate: number;
}

export default function MentorSearch() {
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const supabase = createClient();

    useEffect(() => {
        const fetchTeachers = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('role', 'teacher');

                if (error) throw error;
                setTeachers(data || []);
            } catch (error) {
                console.error("Error fetching teachers:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTeachers();
    }, []);

    const filteredTeachers = teachers.filter(t =>
        t.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.expertise?.some(e => e.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black font-montserrat text-slate-900">Find Your Mentor</h1>
                        <p className="text-slate-500">Connect with expert consultants to guide your journey.</p>
                    </div>

                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by name or expertise..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none shadow-sm"
                        />
                    </div>
                </div>

                {/* Grid */}
                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <LoadingSpinner />
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredTeachers.map((teacher, i) => (
                            <motion.div
                                key={teacher.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="group bg-white rounded-2xl p-6 border border-slate-100 hover:border-orange-200 hover:shadow-xl hover:shadow-orange-500/10 transition-all"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-100 to-yellow-100 flex items-center justify-center text-orange-600 font-bold text-lg">
                                            {teacher.full_name?.[0] || "T"}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900">{teacher.full_name}</h3>
                                            <div className="flex items-center gap-1 text-xs text-slate-500">
                                                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                                                <span>4.9 (120 reviews)</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="px-3 py-1 rounded-full bg-slate-50 text-slate-600 text-xs font-bold border border-slate-100">
                                        ${teacher.hourly_rate || 50}/hr
                                    </div>
                                </div>

                                <p className="text-sm text-slate-600 mb-6 line-clamp-2">
                                    {teacher.bio || "Experienced education consultant specializing in Ivy League admissions and scholarship applications."}
                                </p>

                                <div className="flex flex-wrap gap-2 mb-6">
                                    {(teacher.expertise || ['Admissions', 'Essays']).map((tag, j) => (
                                        <span key={j} className="px-2 py-1 rounded-md bg-orange-50 text-orange-600 text-[10px] font-bold uppercase tracking-wide">
                                            {tag}
                                        </span>
                                    ))}
                                </div>

                                <button className="w-full btn-primary py-2.5 text-sm flex items-center justify-center gap-2 group-hover:gap-3 transition-all">
                                    Book Consultation
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </motion.div>
                        ))}
                    </div>
                )}

                {!isLoading && filteredTeachers.length === 0 && (
                    <div className="text-center py-20">
                        <p className="text-slate-400">No mentors found matching your search.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
