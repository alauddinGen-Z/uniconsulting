"use client";

import { useState, useEffect, useMemo } from "react";
import { PenTool, FileText, Loader2, Check, AlertTriangle, Info, Sparkles, X, Star, TrendingUp, AlertCircle, ChevronDown, ChevronUp, History } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import EssayVersionHistory from "../EssayVersionHistory";

interface EssaysTabProps {
    isLocked?: boolean;
}

type EssayMode = 'common_app' | 'ucas';

interface AIFeedback {
    overallScore: number;
    overallComment: string;
    strengths?: { point: string; explanation: string }[];
    improvements?: { issue: string; suggestion: string; priority: string }[];
    structure?: { score: number; feedback: string };
    voice?: { score: number; feedback: string };
    impact?: { score: number; feedback: string };
    grammarIssues?: { text: string; suggestion: string }[];
    coachingPrompts?: string[];
    pickupTestFlags?: { sentence: string; reason: string }[];
    rawFeedback?: string;
}

const UCAS_MAX_CHARS = 4000;
const UCAS_MAX_LINES = 47;
const COMMON_APP_MAX_WORDS = 650;

export default function EssaysTab({ isLocked }: EssaysTabProps) {
    const [essay, setEssay] = useState("");
    const [essayMode, setEssayMode] = useState<EssayMode>('common_app');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    // AI Review state
    const [isReviewing, setIsReviewing] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    const [feedback, setFeedback] = useState<AIFeedback | null>(null);
    const [expandedSections, setExpandedSections] = useState<string[]>(['strengths', 'improvements']);

    // Version Control state
    const [essayId, setEssayId] = useState<string | null>(null);
    const [showVersionHistory, setShowVersionHistory] = useState(false);

    const supabase = createClient();

    // Calculate word count
    const wordCount = useMemo(() => {
        return essay.trim().split(/\s+/).filter(w => w.length > 0).length;
    }, [essay]);

    // Calculate character count (including spaces)
    const charCount = useMemo(() => essay.length, [essay]);

    // Calculate line count (UCAS counts wrapped lines based on ~95 chars per line)
    const lineCount = useMemo(() => {
        if (!essay) return 0;
        const lines = essay.split('\n');
        let totalLines = 0;
        lines.forEach(line => {
            const wrappedLines = Math.max(1, Math.ceil(line.length / 95));
            totalLines += wrappedLines;
        });
        return totalLines;
    }, [essay]);

    // Validation status
    const validation = useMemo(() => {
        if (essayMode === 'ucas') {
            const charOver = charCount > UCAS_MAX_CHARS;
            const lineOver = lineCount > UCAS_MAX_LINES;
            const charWarning = charCount > UCAS_MAX_CHARS * 0.9;
            const lineWarning = lineCount > UCAS_MAX_LINES * 0.9;
            return {
                isValid: !charOver && !lineOver,
                hasWarning: charWarning || lineWarning,
                charOver, lineOver, charWarning, lineWarning
            };
        } else {
            const wordOver = wordCount > COMMON_APP_MAX_WORDS;
            const wordWarning = wordCount > COMMON_APP_MAX_WORDS * 0.9;
            return { isValid: !wordOver, hasWarning: wordWarning, wordOver, wordWarning };
        }
    }, [essayMode, charCount, lineCount, wordCount]);

    useEffect(() => {
        const fetchEssay = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data, error } = await supabase
                    .from('essays')
                    .select('id, content, updated_at')
                    .eq('student_id', user.id)
                    .eq('title', 'Personal Statement')
                    .maybeSingle();

                if (error) throw error;
                if (data) {
                    setEssay(data.content || "");
                    setEssayId(data.id);
                    setLastSaved(new Date(data.updated_at));
                }
            } catch (error) {
                console.error("Error fetching essay:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchEssay();
    }, []);

    const handleSave = async () => {
        if (isLocked) return;
        setIsSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { data: existing } = await supabase
                .from('essays')
                .select('id')
                .eq('student_id', user.id)
                .eq('title', 'Personal Statement')
                .maybeSingle();

            let error;
            if (existing) {
                // Save current version before updating
                await saveVersion(existing.id);

                const { error: updateError } = await supabase
                    .from('essays')
                    .update({ content: essay, word_count: wordCount, updated_at: new Date().toISOString() })
                    .eq('id', existing.id);
                error = updateError;
                setEssayId(existing.id);
            } else {
                const { data: newEssay, error: insertError } = await supabase
                    .from('essays')
                    .insert({ student_id: user.id, title: 'Personal Statement', content: essay, word_count: wordCount })
                    .select('id')
                    .single();
                error = insertError;
                if (newEssay) {
                    setEssayId(newEssay.id);
                    // Save first version
                    await saveVersion(newEssay.id);
                }
            }

            if (error) throw error;
            setLastSaved(new Date());

            // Award XP for saving essay
            try {
                const { data: xpResult } = await supabase.rpc('award_xp', {
                    user_id: user.id,
                    points: 10
                });
                if (xpResult?.[0]?.leveled_up) {
                    toast.success(`🎉 Level Up! You're now level ${xpResult[0].new_level}!`);
                } else {
                    toast.success("Essay saved successfully (+10 XP)");
                }
            } catch (xpError) {
                // XP award failed but essay saved - still show success
                console.log("XP award skipped:", xpError);
                toast.success("Essay saved successfully");
            }
        } catch (error: any) {
            console.error("Error saving essay:", error);
            toast.error("Failed to save essay");
        } finally {
            setIsSaving(false);
        }
    };

    // Save version to essay_versions table
    const saveVersion = async (essayIdToSave: string) => {
        try {
            // Get current max version number
            const { data: versions } = await supabase
                .from('essay_versions')
                .select('version_number')
                .eq('essay_id', essayIdToSave)
                .order('version_number', { ascending: false })
                .limit(1);

            const nextVersion = (versions?.[0]?.version_number || 0) + 1;

            await supabase
                .from('essay_versions')
                .insert({
                    essay_id: essayIdToSave,
                    content: essay,
                    word_count: wordCount,
                    version_number: nextVersion
                });
        } catch (error) {
            console.error("Error saving version:", error);
        }
    };

    // Handle version restore from Time Travel
    const handleVersionRestore = (content: string) => {
        setEssay(content);
    };

    // AI Review function - calls Supabase Edge Function
    const handleAIReview = async () => {
        if (wordCount < 50) {
            toast.error("Please write at least 50 words before requesting AI feedback");
            return;
        }

        setIsReviewing(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();

            const response = await fetch('https://ylwyuogdfwugjexyhtrq.supabase.co/functions/v1/ai-review', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token || ''}`,
                },
                body: JSON.stringify({
                    content: essay,
                    essayType: essayMode === 'ucas' ? 'UCAS' : 'Common App',
                    wordLimit: COMMON_APP_MAX_WORDS
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to get AI feedback');
            }

            const data = await response.json();
            setFeedback(data.feedback);
            setShowFeedback(true);
            toast.success("AI review complete!");
        } catch (error: any) {
            console.error("AI Review Error:", error);
            toast.error(error.message || "Failed to get AI feedback");
        } finally {
            setIsReviewing(false);
        }
    };

    const toggleSection = (section: string) => {
        setExpandedSections(prev =>
            prev.includes(section)
                ? prev.filter(s => s !== section)
                : [...prev, section]
        );
    };

    const getScoreColor = (score: number) => {
        if (score >= 8) return 'text-green-500';
        if (score >= 6) return 'text-yellow-500';
        return 'text-red-500';
    };

    const getScoreBg = (score: number) => {
        if (score >= 8) return 'bg-green-100';
        if (score >= 6) return 'bg-yellow-100';
        return 'bg-red-100';
    };

    if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-orange-500" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Mode Selector */}
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl">
                <button
                    onClick={() => setEssayMode('common_app')}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all ${essayMode === 'common_app' ? 'bg-white text-orange-600 shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    🇺🇸 Common App (650 words)
                </button>
                <button
                    onClick={() => setEssayMode('ucas')}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all ${essayMode === 'ucas' ? 'bg-white text-purple-600 shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    🇬🇧 UCAS (47 lines / 4000 chars)
                </button>
            </div>

            {/* Mode Info + AI Review Button */}
            <div className={`rounded-2xl p-4 border-2 ${essayMode === 'ucas' ? 'bg-purple-50 border-purple-200' : 'bg-orange-50 border-orange-200'}`}>
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                        <Info className={`w-5 h-5 mt-0.5 ${essayMode === 'ucas' ? 'text-purple-500' : 'text-orange-500'}`} />
                        <div>
                            {essayMode === 'ucas' ? (
                                <>
                                    <p className="font-bold text-purple-900">UCAS Personal Statement</p>
                                    <p className="text-sm text-purple-700 mt-1">Max <strong>4,000 characters</strong> OR <strong>47 lines</strong></p>
                                </>
                            ) : (
                                <>
                                    <p className="font-bold text-orange-900">Common App Essay</p>
                                    <p className="text-sm text-orange-700 mt-1">Max <strong>650 words</strong></p>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Time Travel Button */}
                        <button
                            onClick={() => setShowVersionHistory(true)}
                            disabled={!essayId}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-sm shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title="View and restore previous versions of your essay. Never lose a good idea again!"
                        >
                            <History className="w-4 h-4" />
                            Time Travel
                        </button>

                        {/* AI Review Button */}
                        <button
                            onClick={handleAIReview}
                            disabled={isReviewing || wordCount < 50}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-sm shadow-lg hover:shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isReviewing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Sparkles className="w-4 h-4" />
                            )}
                            {isReviewing ? "Analyzing..." : "Get AI Feedback"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold font-montserrat text-slate-900 flex items-center gap-2">
                    <PenTool className="w-5 h-5 text-orange-500" />
                    Personal Statement
                </h3>
                <div className="flex items-center gap-3">
                    {lastSaved && (
                        <span className="text-xs text-slate-400 font-medium">
                            Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                    {essayMode === 'ucas' ? (
                        <>
                            <div className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 ${validation.charOver ? 'bg-red-100 text-red-600' : validation.charWarning ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-100 text-slate-500'}`}>
                                {validation.charOver && <AlertTriangle className="w-3 h-3" />}
                                {charCount.toLocaleString()} / {UCAS_MAX_CHARS.toLocaleString()} chars
                            </div>
                            <div className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 ${validation.lineOver ? 'bg-red-100 text-red-600' : validation.lineWarning ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-100 text-slate-500'}`}>
                                {validation.lineOver && <AlertTriangle className="w-3 h-3" />}
                                {lineCount} / {UCAS_MAX_LINES} lines
                            </div>
                        </>
                    ) : (
                        <div className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 ${validation.wordOver ? 'bg-red-100 text-red-600' : validation.wordWarning ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-100 text-slate-500'}`}>
                            {validation.wordOver && <AlertTriangle className="w-3 h-3" />}
                            {wordCount} / {COMMON_APP_MAX_WORDS} words
                        </div>
                    )}
                </div>
            </div>

            {/* Progress Bars for UCAS */}
            {essayMode === 'ucas' && (
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>Characters</span>
                            <span>{Math.round((charCount / UCAS_MAX_CHARS) * 100)}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${validation.charOver ? 'bg-red-500' : validation.charWarning ? 'bg-yellow-500' : 'bg-purple-500'}`}
                                style={{ width: `${Math.min(100, (charCount / UCAS_MAX_CHARS) * 100)}%` }} />
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>Lines</span>
                            <span>{Math.round((lineCount / UCAS_MAX_LINES) * 100)}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${validation.lineOver ? 'bg-red-500' : validation.lineWarning ? 'bg-yellow-500' : 'bg-purple-500'}`}
                                style={{ width: `${Math.min(100, (lineCount / UCAS_MAX_LINES) * 100)}%` }} />
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Grid */}
            <div className={`grid gap-6 ${showFeedback && feedback ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
                {/* Textarea */}
                <div className="relative">
                    <textarea
                        disabled={isLocked}
                        value={essay}
                        onChange={(e) => setEssay(e.target.value)}
                        className={`w-full px-6 py-6 rounded-2xl bg-slate-50 border-2 focus:bg-white focus:ring-4 outline-none min-h-[450px] leading-relaxed text-slate-700 resize-y font-medium text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all ${!validation.isValid ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10' : essayMode === 'ucas' ? 'border-transparent focus:border-purple-500 focus:ring-purple-500/10' : 'border-transparent focus:border-orange-500 focus:ring-orange-500/10'}`}
                        placeholder={isLocked ? "Account pending approval. Editing disabled." : essayMode === 'ucas' ? "Write about your academic interests..." : "Tell us your story..."}
                    />
                    <div className="absolute bottom-4 right-4 text-slate-200 pointer-events-none">
                        <FileText className="w-8 h-8" />
                    </div>
                </div>

                {/* AI Feedback Panel */}
                {showFeedback && feedback && (
                    <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-xl overflow-hidden">
                        {/* Feedback Header */}
                        <div className="bg-gradient-to-r from-violet-500 to-purple-600 p-4 text-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-5 h-5" />
                                    <span className="font-bold">AI Essay Review</span>
                                </div>
                                <button onClick={() => setShowFeedback(false)} className="p-1 hover:bg-white/20 rounded-lg">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            {/* Overall Score */}
                            <div className="mt-4 flex items-center gap-4">
                                <div className={`w-16 h-16 rounded-2xl ${getScoreBg(feedback.overallScore)} flex items-center justify-center`}>
                                    <span className={`text-3xl font-black ${getScoreColor(feedback.overallScore)}`}>
                                        {feedback.overallScore}
                                    </span>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm text-white/80">Overall Score</p>
                                    <p className="text-sm mt-1">{feedback.overallComment}</p>
                                </div>
                            </div>
                        </div>

                        {/* Feedback Content */}
                        <div className="max-h-[400px] overflow-y-auto p-4 space-y-3">
                            {/* Score Cards */}
                            {(feedback.structure || feedback.voice || feedback.impact) && (
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                    {feedback.structure && (
                                        <div className="text-center p-3 rounded-xl bg-slate-50">
                                            <p className={`text-2xl font-bold ${getScoreColor(feedback.structure.score)}`}>{feedback.structure.score}</p>
                                            <p className="text-xs text-slate-500">Structure</p>
                                        </div>
                                    )}
                                    {feedback.voice && (
                                        <div className="text-center p-3 rounded-xl bg-slate-50">
                                            <p className={`text-2xl font-bold ${getScoreColor(feedback.voice.score)}`}>{feedback.voice.score}</p>
                                            <p className="text-xs text-slate-500">Voice</p>
                                        </div>
                                    )}
                                    {feedback.impact && (
                                        <div className="text-center p-3 rounded-xl bg-slate-50">
                                            <p className={`text-2xl font-bold ${getScoreColor(feedback.impact.score)}`}>{feedback.impact.score}</p>
                                            <p className="text-xs text-slate-500">Impact</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Strengths */}
                            {feedback.strengths && feedback.strengths.length > 0 && (
                                <div className="border rounded-xl overflow-hidden">
                                    <button onClick={() => toggleSection('strengths')} className="w-full p-3 flex items-center justify-between bg-green-50 hover:bg-green-100 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <Star className="w-4 h-4 text-green-600" />
                                            <span className="font-bold text-green-900">Strengths ({feedback.strengths.length})</span>
                                        </div>
                                        {expandedSections.includes('strengths') ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                    {expandedSections.includes('strengths') && (
                                        <div className="p-3 space-y-2">
                                            {feedback.strengths.map((s, i) => (
                                                <div key={i} className="p-2 bg-green-50 rounded-lg">
                                                    <p className="font-medium text-green-900 text-sm">✓ {s.point}</p>
                                                    <p className="text-xs text-green-700 mt-1">{s.explanation}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Improvements */}
                            {feedback.improvements && feedback.improvements.length > 0 && (
                                <div className="border rounded-xl overflow-hidden">
                                    <button onClick={() => toggleSection('improvements')} className="w-full p-3 flex items-center justify-between bg-amber-50 hover:bg-amber-100 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-amber-600" />
                                            <span className="font-bold text-amber-900">Improvements ({feedback.improvements.length})</span>
                                        </div>
                                        {expandedSections.includes('improvements') ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                    {expandedSections.includes('improvements') && (
                                        <div className="p-3 space-y-2">
                                            {feedback.improvements.map((imp, i) => (
                                                <div key={i} className="p-2 bg-amber-50 rounded-lg">
                                                    <div className="flex items-start justify-between">
                                                        <p className="font-medium text-amber-900 text-sm">{imp.issue}</p>
                                                        <span className={`text-xs px-2 py-0.5 rounded-full ${imp.priority === 'high' ? 'bg-red-100 text-red-600' : imp.priority === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                                                            {imp.priority}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-amber-700 mt-1">💡 {imp.suggestion}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Grammar Issues */}
                            {feedback.grammarIssues && feedback.grammarIssues.length > 0 && (
                                <div className="border rounded-xl overflow-hidden">
                                    <button onClick={() => toggleSection('grammar')} className="w-full p-3 flex items-center justify-between bg-red-50 hover:bg-red-100 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4 text-red-600" />
                                            <span className="font-bold text-red-900">Grammar ({feedback.grammarIssues.length})</span>
                                        </div>
                                        {expandedSections.includes('grammar') ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                    {expandedSections.includes('grammar') && (
                                        <div className="p-3 space-y-2">
                                            {feedback.grammarIssues.map((g, i) => (
                                                <div key={i} className="p-2 bg-red-50 rounded-lg text-sm">
                                                    <p className="text-red-600 line-through">{g.text}</p>
                                                    <p className="text-green-600 font-medium">→ {g.suggestion}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Pickup Test Flags - Coach Mode */}
                            {feedback.pickupTestFlags && feedback.pickupTestFlags.length > 0 && (
                                <div className="border rounded-xl overflow-hidden">
                                    <button onClick={() => toggleSection('pickup')} className="w-full p-3 flex items-center justify-between bg-orange-50 hover:bg-orange-100 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4 text-orange-600" />
                                            <span className="font-bold text-orange-900">Generic Sentences ({feedback.pickupTestFlags.length})</span>
                                        </div>
                                        {expandedSections.includes('pickup') ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                    {expandedSections.includes('pickup') && (
                                        <div className="p-3 space-y-2">
                                            <p className="text-xs text-orange-700 mb-2">These sentences could have been written by anyone. Make them uniquely yours!</p>
                                            {feedback.pickupTestFlags.map((flag, i) => (
                                                <div key={i} className="p-2 bg-orange-50 rounded-lg">
                                                    <p className="font-medium text-orange-900 text-sm italic">"{flag.sentence}"</p>
                                                    <p className="text-xs text-orange-700 mt-1">💡 {flag.reason}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Coaching Prompts - Questions to Dig Deeper */}
                            {feedback.coachingPrompts && feedback.coachingPrompts.length > 0 && (
                                <div className="border-2 border-indigo-200 rounded-xl overflow-hidden bg-indigo-50">
                                    <div className="p-3 flex items-center gap-2 bg-indigo-100">
                                        <Sparkles className="w-4 h-4 text-indigo-600" />
                                        <span className="font-bold text-indigo-900">Questions to Consider</span>
                                    </div>
                                    <div className="p-3 space-y-2">
                                        {feedback.coachingPrompts.map((prompt, i) => (
                                            <div key={i} className="flex items-start gap-2 text-sm">
                                                <span className="text-indigo-500 font-bold">{i + 1}.</span>
                                                <p className="text-indigo-800">{prompt}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Raw Feedback Fallback - Try to format nicely */}
                            {feedback.rawFeedback && (
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Info className="w-4 h-4 text-slate-500" />
                                        <span className="font-medium text-slate-700 text-sm">AI Feedback</span>
                                    </div>
                                    {(() => {
                                        // Try to parse JSON from rawFeedback
                                        try {
                                            const jsonMatch = feedback.rawFeedback.match(/\{[\s\S]*\}/);
                                            if (jsonMatch) {
                                                const parsed = JSON.parse(jsonMatch[0]);
                                                return (
                                                    <div className="space-y-4">
                                                        {parsed.overallComment && (
                                                            <p className="text-slate-700 font-medium">{parsed.overallComment}</p>
                                                        )}
                                                        {parsed.strengths && parsed.strengths.length > 0 && (
                                                            <div>
                                                                <p className="font-bold text-green-700 text-sm mb-2">✓ Strengths</p>
                                                                <ul className="space-y-2">
                                                                    {parsed.strengths.map((s: { point: string; explanation: string }, i: number) => (
                                                                        <li key={i} className="bg-green-50 p-2 rounded-lg text-sm">
                                                                            <span className="font-medium text-green-900">{s.point}</span>
                                                                            {s.explanation && <p className="text-green-700 text-xs mt-1">{s.explanation}</p>}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                        {parsed.improvements && parsed.improvements.length > 0 && (
                                                            <div>
                                                                <p className="font-bold text-amber-700 text-sm mb-2">↑ Areas for Improvement</p>
                                                                <ul className="space-y-2">
                                                                    {parsed.improvements.map((imp: { issue: string; suggestion: string; priority?: string }, i: number) => (
                                                                        <li key={i} className="bg-amber-50 p-2 rounded-lg text-sm">
                                                                            <span className="font-medium text-amber-900">{imp.issue}</span>
                                                                            {imp.suggestion && <p className="text-amber-700 text-xs mt-1">💡 {imp.suggestion}</p>}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                        {parsed.coachingPrompts && parsed.coachingPrompts.length > 0 && (
                                                            <div>
                                                                <p className="font-bold text-indigo-700 text-sm mb-2">🤔 Questions to Consider</p>
                                                                <ul className="space-y-1">
                                                                    {parsed.coachingPrompts.map((prompt: string, i: number) => (
                                                                        <li key={i} className="text-sm text-indigo-800 flex gap-2">
                                                                            <span className="text-indigo-500 font-bold">{i + 1}.</span>
                                                                            {prompt}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }
                                            throw new Error("No JSON found");
                                        } catch {
                                            // If JSON parsing fails, display as formatted text
                                            return (
                                                <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                                                    {feedback.rawFeedback
                                                        .split('\n')
                                                        .map((line, i) => (
                                                            <p key={i} className={line.trim() === '' ? 'h-3' : 'mb-2'}>
                                                                {line}
                                                            </p>
                                                        ))}
                                                </div>
                                            );
                                        }
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Warning Message */}
            {!validation.isValid && (
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="font-bold text-red-900">Limit Exceeded</p>
                        <p className="text-sm text-red-700">
                            {essayMode === 'ucas'
                                ? `Your essay exceeds the UCAS limits. Please reduce to ${UCAS_MAX_CHARS} characters and ${UCAS_MAX_LINES} lines.`
                                : `Your essay exceeds ${COMMON_APP_MAX_WORDS} words. Please shorten your essay.`
                            }
                        </p>
                    </div>
                </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end gap-3">
                <button
                    onClick={handleSave}
                    disabled={isLocked || isSaving}
                    className={`px-8 py-3 text-sm rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-bold text-white ${essayMode === 'ucas' ? 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:shadow-purple-500/30' : 'bg-gradient-to-r from-orange-500 to-pink-500 hover:shadow-orange-500/30'}`}
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {isSaving ? "Saving..." : "Save Draft"}
                </button>
            </div>

            {/* Version History Modal */}
            {showVersionHistory && (
                <EssayVersionHistory
                    essayId={essayId}
                    currentContent={essay}
                    onRestore={handleVersionRestore}
                    onClose={() => setShowVersionHistory(false)}
                />
            )}
        </div>
    );
}
