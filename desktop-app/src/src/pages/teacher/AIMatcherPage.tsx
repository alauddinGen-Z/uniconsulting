import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { supabase } from '../../lib/supabase';
import {
    Search, Sparkles, GraduationCap, MapPin, DollarSign, Target,
    Plus, Check, ArrowRight, Star, Loader2
} from 'lucide-react';

// API endpoint for university matcher
const UNIVERSITY_MATCHER_API = 'https://ylwyuogdfwugjexyhtrq.supabase.co/functions/v1/university-matcher';

interface UniversityMatch {
    name: string;
    country: string;
    matchScore: number;
    reasons: string[];
    requirements: string;
    tuitionRange: string;
}

interface Student {
    id: string;
    full_name: string;
    email: string;
    approval_status: string;
    gpa?: number;
    sat_score?: number;
    ielts_score?: number;
    toefl_score?: number;
    target_major?: string;
    target_country?: string;
}

export default function AIMatcherPage() {
    const { user } = useAppStore();
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isMatching, setIsMatching] = useState(false);
    const [matches, setMatches] = useState<UniversityMatch[]>([]);
    const [addingUni, setAddingUni] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadStudents();
    }, [user]);

    const loadStudents = async () => {
        if (!user?.id) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);

        try {
            // Use AbortSignal for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('teacher_id', user.id)
                .eq('approval_status', 'approved')
                .order('full_name')
                .abortSignal(controller.signal);

            clearTimeout(timeoutId);

            if (error) {
                console.error('[AIMatcherPage] Supabase error:', error);
            }
            setStudents(data || []);
        } catch (err) {
            console.error('[AIMatcherPage] Failed to load students:', err);
            setStudents([]);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredStudents = searchQuery
        ? students.filter(s =>
            s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.target_major?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : students;

    const selectedStudent = students.find(s => s.id === selectedStudentId);

    const handleFindMatches = async () => {
        if (!selectedStudentId) return;

        setIsMatching(true);
        setMatches([]);
        setError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();

            const response = await fetch(UNIVERSITY_MATCHER_API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token || ''}`,
                },
                body: JSON.stringify({ studentId: selectedStudentId })
            });

            const data = await response.json();

            if (data.success) {
                setMatches(data.matches || []);
            } else {
                setError(data.error || 'Failed to find matches');
            }
        } catch (err) {
            console.error('Matching error:', err);
            setError('Failed to connect to AI service');
        } finally {
            setIsMatching(false);
        }
    };

    const handleAddUniversity = async (match: UniversityMatch) => {
        if (!selectedStudentId) return;
        setAddingUni(match.name);

        try {
            const { data: existing } = await supabase
                .from('student_universities')
                .select('id')
                .eq('student_id', selectedStudentId)
                .eq('university_name', match.name)
                .maybeSingle();

            if (existing) {
                setAddingUni(null);
                return;
            }

            let category = 'match';
            if (match.matchScore >= 85) category = 'safety';
            else if (match.matchScore < 60) category = 'reach';

            await supabase.from('student_universities').insert({
                student_id: selectedStudentId,
                university_name: match.name,
                country: match.country,
                category,
                notes: `AI Match Score: ${match.matchScore}%. ${match.reasons.join(' ')}`,
                application_status: 'researching'
            });
        } catch (err) {
            console.error('Add error:', err);
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
        <div className="flex h-full gap-6">
            {/* Left Panel - Student Selection */}
            <div className="w-72 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
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
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                        </div>
                    ) : filteredStudents.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm">
                            <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">No approved students</p>
                        </div>
                    ) : (
                        <div className="p-2">
                            {filteredStudents.map(student => (
                                <button
                                    key={student.id}
                                    onClick={() => {
                                        setSelectedStudentId(student.id);
                                        setMatches([]);
                                        setError(null);
                                    }}
                                    className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all mb-1 ${selectedStudentId === student.id
                                        ? 'bg-purple-500 text-white shadow-lg'
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
                                        <p className="font-bold text-sm truncate">{student.full_name}</p>
                                        <p className={`text-xs truncate ${selectedStudentId === student.id ? 'text-white/70' : 'text-slate-400'}`}>
                                            {student.target_major || 'No major set'}
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
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                {!selectedStudentId ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
                        <div className="w-24 h-24 rounded-full bg-purple-100 flex items-center justify-center mb-6">
                            <Sparkles className="w-12 h-12 text-purple-300" />
                        </div>
                        <h3 className="font-bold text-xl text-slate-500 mb-2">Select a Student</h3>
                        <p className="text-sm text-center max-w-md">
                            Choose a student to find AI-recommended universities based on their profile.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Student Header */}
                        <div className="p-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-bold">
                                        {selectedStudent?.full_name?.charAt(0) || '?'}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold">{selectedStudent?.full_name}</h2>
                                        <div className="flex items-center gap-4 mt-1 text-white/80 text-sm">
                                            {selectedStudent?.target_major && (
                                                <span className="flex items-center gap-1">
                                                    <GraduationCap className="w-4 h-4" />
                                                    {selectedStudent.target_major}
                                                </span>
                                            )}
                                            {selectedStudent?.target_country && (
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="w-4 h-4" />
                                                    {selectedStudent.target_country}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={handleFindMatches}
                                    disabled={isMatching}
                                    className="px-6 py-3 bg-white text-purple-600 rounded-xl font-bold flex items-center gap-2 hover:bg-purple-50 transition disabled:opacity-50 shadow-lg"
                                >
                                    {isMatching ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
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
                                    <p className="text-xl font-bold">{selectedStudent?.sat_score || '-'}</p>
                                    <p className="text-xs text-white/70">SAT</p>
                                </div>
                                <div className="bg-white/10 rounded-xl p-3 text-center">
                                    <p className="text-xl font-bold">{selectedStudent?.ielts_score || '-'}</p>
                                    <p className="text-xs text-white/70">IELTS</p>
                                </div>
                                <div className="bg-white/10 rounded-xl p-3 text-center">
                                    <p className="text-xl font-bold">{selectedStudent?.toefl_score || '-'}</p>
                                    <p className="text-xs text-white/70">TOEFL</p>
                                </div>
                            </div>
                        </div>

                        {/* Results Area */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {error && (
                                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
                                    {error}
                                </div>
                            )}

                            {isMatching ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                    <Loader2 className="w-12 h-12 animate-spin text-purple-500 mb-4" />
                                    <p className="text-lg font-medium text-slate-600">AI is analyzing student profile...</p>
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
                                                        className="p-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition disabled:opacity-50"
                                                        title="Add to student's list"
                                                    >
                                                        {addingUni === match.name ? (
                                                            <Loader2 className="w-5 h-5 animate-spin" />
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
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
