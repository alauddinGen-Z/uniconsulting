import { TableSkeleton } from "@/components/shared/Skeletons";

export default function Loading() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="animate-pulse">
                    <div className="h-8 w-48 bg-slate-200 rounded-xl mb-2" />
                    <div className="h-4 w-64 bg-slate-200 rounded-xl" />
                </div>
            </div>
            <TableSkeleton rows={6} />
        </div>
    );
}
