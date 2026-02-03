import { Skeleton } from "@/components/shared/Skeletons";

export default function Loading() {
    return (
        <div className="flex h-full">
            {/* Conversation List */}
            <div className="w-80 border-r border-slate-200 p-4 space-y-3">
                <Skeleton className="h-10 w-full" />
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-32" />
                        </div>
                    </div>
                ))}
            </div>
            {/* Chat Area */}
            <div className="flex-1 p-6 flex items-center justify-center">
                <Skeleton className="h-8 w-48" />
            </div>
        </div>
    );
}
