"use client";

/**
 * Dashboard Skeleton Components
 * 
 * Provides instant visual feedback during data loading.
 * Creates perception of speed even before data arrives.
 * 
 * @file src/components/shared/Skeletons.tsx
 */

import { cn } from "@/lib/utils";

interface SkeletonProps {
    className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
    return (
        <div className={cn(
            "animate-pulse bg-slate-200 rounded-xl",
            className
        )} />
    );
}

export function CardSkeleton() {
    return (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <Skeleton className="h-12 w-12 rounded-2xl mb-4" />
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-4 w-24" />
        </div>
    );
}

export function StatGridSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
        </div>
    );
}

export function TableRowSkeleton() {
    return (
        <tr className="border-b border-slate-50">
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <Skeleton className="h-4 w-32" />
                </div>
            </td>
            <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
            <td className="px-6 py-4"><Skeleton className="h-4 w-16" /></td>
            <td className="px-6 py-4"><Skeleton className="h-6 w-20 rounded-lg" /></td>
        </tr>
    );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50">
                <Skeleton className="h-6 w-40" />
            </div>
            <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                        <th className="px-6 py-4"><Skeleton className="h-3 w-20" /></th>
                        <th className="px-6 py-4"><Skeleton className="h-3 w-16" /></th>
                        <th className="px-6 py-4"><Skeleton className="h-3 w-12" /></th>
                        <th className="px-6 py-4"><Skeleton className="h-3 w-16" /></th>
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: rows }).map((_, i) => (
                        <TableRowSkeleton key={i} />
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function KanbanSkeleton() {
    return (
        <div className="flex gap-6 overflow-x-auto pb-4">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex-shrink-0 w-72 bg-slate-100 rounded-2xl p-4">
                    <Skeleton className="h-5 w-24 mb-4" />
                    <div className="space-y-3">
                        <Skeleton className="h-24 w-full rounded-xl" />
                        <Skeleton className="h-24 w-full rounded-xl" />
                        <Skeleton className="h-24 w-full rounded-xl" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function DashboardPageSkeleton() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <Skeleton className="h-8 w-48 mb-2" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-10 w-32 rounded-xl" />
            </div>
            {/* Stats */}
            <StatGridSkeleton />
            {/* Table */}
            <TableSkeleton rows={4} />
        </div>
    );
}
