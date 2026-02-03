import { TableSkeleton } from "@/components/shared/Skeletons";

export default function Loading() {
    return (
        <div className="p-6 space-y-6">
            <div className="h-8 w-48 bg-slate-200 animate-pulse rounded-xl" />
            <TableSkeleton rows={6} />
        </div>
    );
}
