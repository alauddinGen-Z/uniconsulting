"use client";

import { useState } from "react";
import { Search, Sparkles, GraduationCap, MapPin, DollarSign, Target, Plus, Check, ArrowRight, ExternalLink, Star } from "lucide-react";
import { useTeacherData } from "@/contexts/TeacherDataContext";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { API_ENDPOINTS } from "@/lib/config";

interface UniversityMatch {
    name: string;
    country: string;
    matchScore: number;
    reasons: string[];
    requirements: string;
    tuitionRange: string;
    website?: string;
}

export default function AIMatcherView() {
    const { students, isLoading: studentsLoading } = useTeacherData();
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isMatching, setIsMatching] = useState(false);
    const [matches, setMatches] = useState<UniversityMatch[]>([]);
    const [summary, setSummary] = useState("");
    const [addingUni, setAddingUni] = useState<string | null>(null);
    const supabase = createClient();

    // Only show approved students
    const approvedStudents = students.filter(s => s.approval_status === 'approved');
    const filteredStudents = searchQuery
        ? approvedStudents.filter(s =>
            s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.preferred_university?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : approvedStudents;

    const selectedStudent = approvedStudents.find(s => s.id === selectedStudentId);

    const handleFindMatches = async () => {
        if (!selectedStudentId) return;

        setIsMatching(true);
        setMatches([]);
        setSummary("");

        try {
            // Get the current session for auth token
            const { data: { session } } = await supabase.auth.getSession();

            const response = await fetch(API_ENDPOINTS.UNIVERSITY_MATCHER, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token || ''}`,
                    'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
                },
                body: JSON.stringify({ studentId: selectedStudentId })
            });

            const data = await response.json();
            console.log("AI Matcher response:", data);

            if (data.success) {
                setMatches(data.matches || []);
                setSummary(data.summary || "");
                toast.success(`Found ${data.matches?.length || 0} university matches!`);
            } else {
                toast.error(data.error || "Failed to find matches");
            }
        } catch (error) {
            console.error("Matching error:", error);
            toast.error("Failed to connect to AI service");
        } finally {
            setIsMatching(false);
        }
    };

    const handleAddUniversity = async (match: UniversityMatch) => {
        if (!selectedStudentId) return;

        setAddingUni(match.name);

        try {
            // Check if already exists
            const { data: existing } = await supabase
                .from('student_universities')
                .select('id')
                .eq('student_id', selectedStudentId)
                .eq('university_name', match.name)
                .maybeSingle();

            if (existing) {
                toast.info("University already in student's list");
                setAddingUni(null);
                return;
            }

            // Determine category based on match score
            let category = 'match';
            if (match.matchScore >= 85) category = 'safety';
            else if (match.matchScore < 60) category = 'reach';

            const { error } = await supabase
                .from('student_universities')
                .insert({
                    student_id: selectedStudentId,
                    university_name: match.name,
                    country: match.country,
                    category,
                    notes: `AI Match Score: ${match.matchScore}%. ${match.reasons.join(' ')}`,
                    application_status: 'researching'
                });

            if (error) throw error;

            toast.success(`Added ${match.name} to student's list!`);
        } catch (error) {
            console.error("Add error:", error);
            toast.error("Failed to add university");
        } finally {
            setAddingUni(null);
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-600 bg-green-100';
        if (score >= 60) return 'text-yellow-600 bg-yellow-100';
        return 'text-red-600 bg-red-100';
    };

    const getScoreLabel = (score: number) => {
        if (score >= 85) return 'Safety';
        if (score >= 70) return 'Match';
        if (score >= 50) return 'Reach';
        return 'High Reach';
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex-none mb-6">
                <header className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center">
                        <Sparkles className="w-7 h-7 text-purple-600" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black font-montserrat text-slate-900 mb-1">AI UNIVERSITY MATCHER</h1>
                        <p className="text-slate-500 font-medium">Match students with their ideal universities using AI</p>
                    </div>
                </header>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex gap-6 min-h-0">
                {/* Left Panel - Student Selection */}
                <div className="w-80 flex-shrink-0 bg-white rounded-2xl shadow-lg border border-slate-100 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-100">
                        <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                            <Target className="w-5 h-5 text-purple-500" />
                            Select Student
                        </h3>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search students..."
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 rounded-xl text-sm border-0 focus:ring-2 focus:ring-purple-500/20 outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {studentsLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <LoadingSpinner />
                            </div>
                        ) : filteredStudents.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm">
                                <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                <p className="font-medium">No approved students</p>
                                <p className="text-xs mt-1">Approve students first to use AI matching</p>
                            </div>
                        ) : (
                            <div className="p-2">
                                {filteredStudents.map(student => (
                                    <button
                                        key={student.id}
                                        onClick={() => {
                                            setSelectedStudentId(student.id);
                                            setMatches([]);
                                            setSummary("");
                                        }}
                                        className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all mb-1 ${selectedStudentId === student.id
                                            ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                                            : 'hover:bg-slate-50 text-slate-700'
                                            }`}
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${selectedStudentId === student.id
                                            ? 'bg-white/20 text-white'
                                            : 'bg-gradient-to-br from-purple-400 to-pink-500 text-white'
                                            }`}>
                                            {student.full_name?.charAt(0) || '?'}
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <p className="font-bold text-sm truncate">{student.full_name || 'Unnamed'}</p>
                                            <p className={`text-xs truncate ${selectedStudentId === student.id ? 'text-white/70' : 'text-slate-400'}`}>
                                                {student.preferred_major || 'No major set'}
                                            </p>
                                        </div>
                                        <ArrowRight className={`w-4 h-4 ${selectedStudentId === student.id ? 'text-white' : 'text-slate-300'}`} />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel - AI Matching */}
                <div className="flex-1 bg-white rounded-2xl shadow-lg border border-slate-100 flex flex-col overflow-hidden">
                    {!selectedStudentId ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
                            <div className="w-24 h-24 rounded-full bg-purple-100 flex items-center justify-center mb-6">
                                <Sparkles className="w-12 h-12 text-purple-300" />
                            </div>
                            <h3 className="font-bold text-xl text-slate-500 mb-2">Select a Student</h3>
                            <p className="text-sm text-center max-w-md">
                                Choose a student from the list to find AI-recommended universities based on their profile, grades, and test scores.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Student Summary Header */}
                            <div className="p-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-bold">
                                            {selectedStudent?.full_name?.charAt(0) || '?'}
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold">{selectedStudent?.full_name}</h2>
                                            <div className="flex items-center gap-4 mt-1 text-white/80 text-sm">
                                                {selectedStudent?.preferred_major && (
                                                    <span className="flex items-center gap-1">
                                                        <GraduationCap className="w-4 h-4" />
                                                        {selectedStudent.preferred_major}
                                                    </span>
                                                )}
                                                {selectedStudent?.preferred_country && (
                                                    <span className="flex items-center gap-1">
                                                        <MapPin className="w-4 h-4" />
                                                        {selectedStudent.preferred_country}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleFindMatches}
                                        disabled={isMatching}
                                        className="px-6 py-3 bg-white text-purple-600 rounded-xl font-bold flex items-center gap-2 hover:bg-purple-50 transition-colors disabled:opacity-50 shadow-lg"
                                    >
                                        {isMatching ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                                                Analyzing...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-5 h-5" />
                                                Find Matches
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Quick Stats */}
                                <div className="grid grid-cols-4 gap-4 mt-6">
                                    <div className="bg-white/10 rounded-xl p-3 text-center">
                                        <p className="text-xl font-bold">{selectedStudent?.gpa || '-'}</p>
                                        <p className="text-xs text-white/70">GPA</p>
                                    </div>
                                    <div className="bg-white/10 rounded-xl p-3 text-center">
                                        <p className="text-xl font-bold">{selectedStudent?.sat_total || '-'}</p>
                                        <p className="text-xs text-white/70">SAT</p>
                                    </div>
                                    <div className="bg-white/10 rounded-xl p-3 text-center">
                                        <p className="text-xl font-bold">{selectedStudent?.ielts_overall || '-'}</p>
                                        <p className="text-xs text-white/70">IELTS</p>
                                    </div>
                                    <div className="bg-white/10 rounded-xl p-3 text-center">
                                        <p className="text-xl font-bold">{selectedStudent?.toefl_total || '-'}</p>
                                        <p className="text-xs text-white/70">TOEFL</p>
                                    </div>
                                </div>
                            </div>

                            {/* Results Area */}
                            <div className="flex-1 overflow-y-auto p-6">
                                {isMatching ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                        <LoadingSpinner />
                                        <p className="mt-6 text-lg font-medium text-slate-600">AI is analyzing student profile...</p>
                                        <p className="text-sm">This may take a few seconds</p>
                                    </div>
                                ) : matches.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                        <Target className="w-16 h-16 mb-4 opacity-30" />
                                        <p className="font-medium text-lg text-slate-500">No matches yet</p>
                                        <p className="text-sm">Click "Find Matches" to get AI recommendations</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {/* Matches Grid */}
                                        <div className="grid gap-4">
                                            {matches.map((match, index) => (
                                                <div
                                                    key={index}
                                                    className="bg-slate-50 rounded-2xl p-5 hover:bg-white hover:shadow-lg hover:border-purple-200 border border-transparent transition-all"
                                                >
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                                                                #{index + 1}
                                                            </div>
                                                            <div>
                                                                <h3 className="font-bold text-lg text-slate-900">{match.name}</h3>
                                                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                                                    <MapPin className="w-4 h-4" />
                                                                    {match.country}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className={`px-3 py-1 rounded-lg font-bold text-sm ${getScoreColor(match.matchScore)}`}>
                                                                {match.matchScore}% - {getScoreLabel(match.matchScore)}
                                                            </div>
                                                            <button
                                                                onClick={() => handleAddUniversity(match)}
                                                                disabled={addingUni === match.name}
                                                                className="p-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
                                                                title="Add to student's list"
                                                            >
                                                                {addingUni === match.name ? (
                                                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                                ) : (
                                                                    <Plus className="w-5 h-5" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Reasons */}
                                                    <div className="mb-3">
                                                        <ul className="space-y-1">
                                                            {match.reasons.map((reason, i) => (
                                                                <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                                                                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                                                    {reason}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>

                                                    {/* Requirements & Tuition */}
                                                    <div className="flex items-center gap-6 text-sm text-slate-500 pt-3 border-t border-slate-200">
                                                        <span className="flex items-center gap-1">
                                                            <Star className="w-4 h-4" />
                                                            {match.requirements}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <DollarSign className="w-4 h-4" />
                                                            {match.tuitionRange}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
