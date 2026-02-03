import { Skeleton } from "@/components/shared/Skeletons";

export default function Loading() {
    return (
        <div className="p-6 max-w-2xl mx-auto space-y-6">
            {/* Profile Header */}
            <div className="flex items-center gap-4">
                <Skeleton className="h-20 w-20 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32" />
                </div>
            </div>
            {/* Form Fields */}
            <div className="bg-white rounded-2xl p-6 space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-1/2" />
            </div>
        </div>
    );
}
