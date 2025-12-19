"use client";

import { useAgencyTheme } from "@/hooks/useAgencyTheme";

export function ThemeApplier({ children }: { children: React.ReactNode }) {
    useAgencyTheme();
    return <>{children}</>;
}
