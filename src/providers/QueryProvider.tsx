"use client";

/**
 * React Query Provider
 * 
 * Provides global caching for data fetching with:
 * - staleTime: 5 minutes (data appears instantly on tab switch)
 * - cacheTime: 30 minutes (keep data in memory)
 * - refetchOnWindowFocus: true (background updates)
 * 
 * @file src/providers/QueryProvider.tsx
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export default function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                // Data stays fresh for 5 minutes - instant on tab switch
                staleTime: 5 * 60 * 1000,
                // Keep cached data for 30 minutes
                gcTime: 30 * 60 * 1000,
                // Silently refresh when window gains focus
                refetchOnWindowFocus: true,
                // Don't retry on error
                retry: 1,
            },
        },
    }));

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
