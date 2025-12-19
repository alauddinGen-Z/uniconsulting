import { Skeleton } from "@/components/shared/Skeletons";

export default function Loading() {
    return (
        <div className="flex h-full gap-4">
            {/* Conversation List Skeleton */}
            <div className="w-80 bg-white rounded-2xl p-4 space-y-3">
                <Skeleton className="h-10 w-full rounded-xl mb-4" />
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-3">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-48" />
                        </div>
                    </div>
                ))}
            </div>
            {/* Chat Area Skeleton */}
            <div className="flex-1 bg-white rounded-2xl p-6 flex flex-col">
                <div className="flex-1 flex items-center justify-center">
                    <Skeleton className="h-8 w-48" />
                </div>
                <Skeleton className="h-12 w-full rounded-xl" />
            </div>
        </div>
    );
}
