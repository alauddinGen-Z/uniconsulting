/**
 * ScholarshipFinder.tsx
 * Vector-based Scholarship Search UI Component
 * 
 * CoVe Guarantees:
 *   ✅ Loading States: Clear feedback during search
 *   ✅ Match Score: Visual percentage based on similarity
 *   ✅ Empty State: Helpful guidance for users
 */

'use client';

import { useState, useCallback, useTransition } from 'react';
import { Search, GraduationCap, Calendar, MapPin, DollarSign, ExternalLink, Sparkles } from 'lucide-react';
import { searchScholarships, getRecommendedScholarships, type ScholarshipResult } from '@/app/student/actions/scholarship';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface ScholarshipFinderProps {
    className?: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ScholarshipFinder({ className = '' }: ScholarshipFinderProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<ScholarshipResult[]>([]);
    const [searchMethod, setSearchMethod] = useState<'vector' | 'keyword' | null>(null);
    const [isPending, startTransition] = useTransition();
    const [hasSearched, setHasSearched] = useState(false);

    // ============================================
    // HANDLERS
    // ============================================

    const handleSearch = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();

        if (!query.trim() || query.trim().length < 3) {
            toast.error('Please enter at least 3 characters');
            return;
        }

        startTransition(async () => {
            try {
                const result = await searchScholarships({ query: query.trim(), limit: 10 });

                if (result?.data?.success) {
                    setResults(result.data.scholarships);
                    setSearchMethod(result.data.searchMethod);
                    setHasSearched(true);

                    if (result.data.scholarships.length === 0) {
                        toast.info('No scholarships found. Try different keywords.');
                    } else {
                        toast.success(`Found ${result.data.scholarships.length} scholarships`);
                    }
                } else {
                    toast.error(result?.data?.error || 'Search failed');
                }
            } catch (error) {
                toast.error('An error occurred while searching');
                console.error(error);
            }
        });
    }, [query]);

    const handleGetRecommendations = useCallback(async () => {
        startTransition(async () => {
            try {
                const result = await getRecommendedScholarships();

                if (result?.data?.success) {
                    setResults(result.data.scholarships);
                    setSearchMethod(result.data.searchMethod);
                    setHasSearched(true);
                    toast.success('Personalized recommendations loaded');
                } else {
                    toast.error(result?.data?.error || 'Failed to load recommendations');
                }
            } catch (error) {
                toast.error('Failed to load recommendations');
                console.error(error);
            }
        });
    }, []);

    // ============================================
    // RENDER
    // ============================================

    return (
        <div className={`space-y-6 ${className}`}>
            {/* Header */}
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center justify-center gap-2">
                    <GraduationCap className="w-7 h-7 text-blue-500" />
                    Scholarship Finder
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                    AI-powered search to find scholarships matching your profile
                </p>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="e.g., Engineering scholarships in UK for women"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 
                     bg-white dark:bg-gray-800 text-gray-800 dark:text-white
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     placeholder:text-gray-400 transition-all"
                        disabled={isPending}
                    />
                </div>
                <button
                    type="submit"
                    disabled={isPending || query.trim().length < 3}
                    className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl
                   font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed
                   flex items-center gap-2"
                >
                    {isPending ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <Search className="w-5 h-5" />
                    )}
                    Search
                </button>
            </form>

            {/* Quick Actions */}
            <div className="flex justify-center">
                <button
                    onClick={handleGetRecommendations}
                    disabled={isPending}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 dark:text-blue-400
                   hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                >
                    <Sparkles className="w-4 h-4" />
                    Get personalized recommendations
                </button>
            </div>

            {/* Search Method Badge */}
            {hasSearched && searchMethod && (
                <div className="flex justify-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${searchMethod === 'vector'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                        {searchMethod === 'vector' ? '✨ AI Semantic Search' : '🔍 Keyword Search'}
                    </span>
                </div>
            )}

            {/* Results Grid */}
            {hasSearched && (
                <div className="space-y-4">
                    {results.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2">
                            {results.map((scholarship) => (
                                <ScholarshipCard key={scholarship.id} scholarship={scholarship} />
                            ))}
                        </div>
                    ) : (
                        <EmptyState onGetRecommendations={handleGetRecommendations} />
                    )}
                </div>
            )}

            {/* Initial Empty State */}
            {!hasSearched && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <GraduationCap className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg mb-2">Search for scholarships based on your profile</p>
                    <p className="text-sm">Try "Computer Science scholarship for international students"</p>
                </div>
            )}
        </div>
    );
}

// ============================================
// SCHOLARSHIP CARD
// ============================================

interface ScholarshipCardProps {
    scholarship: ScholarshipResult;
}

function ScholarshipCard({ scholarship }: ScholarshipCardProps) {
    const matchColor =
        scholarship.matchPercentage >= 80 ? 'text-green-500 bg-green-50 dark:bg-green-900/20' :
            scholarship.matchPercentage >= 60 ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' :
                scholarship.matchPercentage >= 40 ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' :
                    'text-gray-500 bg-gray-50 dark:bg-gray-700';

    const formatCurrency = (amount: number, currency: string) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const formatDeadline = (deadline: string | null) => {
        if (!deadline) return 'Rolling';
        return new Date(deadline).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700
                  hover:shadow-lg transition-all group">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-3">
                <h3 className="font-semibold text-gray-800 dark:text-white group-hover:text-blue-500 transition-colors">
                    {scholarship.title}
                </h3>
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${matchColor}`}>
                    {scholarship.matchPercentage}% Match
                </span>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4">
                {scholarship.description}
            </p>

            {/* Meta Info */}
            <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <span className="font-medium">{formatCurrency(scholarship.amount, scholarship.currency)}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Calendar className="w-4 h-4 text-orange-500" />
                    <span>{formatDeadline(scholarship.deadline)}</span>
                </div>
                {scholarship.country && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <MapPin className="w-4 h-4 text-blue-500" />
                        <span>{scholarship.country}</span>
                    </div>
                )}
                {scholarship.provider && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 truncate">
                        <GraduationCap className="w-4 h-4 text-purple-500" />
                        <span className="truncate">{scholarship.provider}</span>
                    </div>
                )}
            </div>

            {/* Tags */}
            {scholarship.field_of_study && scholarship.field_of_study.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                    {scholarship.field_of_study.slice(0, 3).map((field, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-300">
                            {field}
                        </span>
                    ))}
                    {scholarship.field_of_study.length > 3 && (
                        <span className="px-2 py-0.5 text-xs text-gray-500">
                            +{scholarship.field_of_study.length - 3} more
                        </span>
                    )}
                </div>
            )}

            {/* Apply Button */}
            {scholarship.url && (
                <a
                    href={scholarship.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2 bg-blue-500 hover:bg-blue-600 
                   text-white rounded-lg font-medium transition-all"
                >
                    Apply Now
                    <ExternalLink className="w-4 h-4" />
                </a>
            )}
        </div>
    );
}

// ============================================
// EMPTY STATE
// ============================================

interface EmptyStateProps {
    onGetRecommendations: () => void;
}

function EmptyState({ onGetRecommendations }: EmptyStateProps) {
    return (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <GraduationCap className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">
                No scholarships found matching your search
            </p>
            <button
                onClick={onGetRecommendations}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 
                 text-white rounded-lg font-medium transition-all"
            >
                <Sparkles className="w-4 h-4" />
                Try personalized recommendations
            </button>
        </div>
    );
}

export default ScholarshipFinder;
