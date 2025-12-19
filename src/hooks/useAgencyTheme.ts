"use client";

import { useEffect } from "react";
import { useAppStore } from "@/stores/appStore";
import { UNICONSULTING_THEME, GLOBAL_COMPASS_THEME, getThemeCSSVariables, ThemeConfig } from "@/lib/theme-config";

/**
 * Hook to apply agency-specific white-labeling
 */
export function useAgencyTheme() {
    const user = useAppStore((state) => state.user);

    useEffect(() => {
        if (!user?.agencyId) return;

        // In a real SaaS, we would fetch the theme config from the DB for this agency_id
        // For now, we map specific agency IDs to presets or use default

        let activeTheme: ThemeConfig = UNICONSULTING_THEME;

        // Example mapping for demo
        // Replace with actual agency IDs from your database
        if (user.agencyId === 'global-compass-id-placeholder') {
            activeTheme = GLOBAL_COMPASS_THEME;
        }

        // Apply theme variables to document root
        const cssVariables = getThemeCSSVariables(activeTheme);
        const root = document.documentElement;

        // Parse the string and set properties
        cssVariables.split(';').forEach(prop => {
            const [key, value] = prop.split(':').map(s => s.trim());
            if (key && value) {
                root.style.setProperty(key, value);
            }
        });

        // Add theme class for specific overrides if needed
        root.classList.remove('theme-global-compass');
        if (activeTheme.name === 'Global Compass') {
            root.classList.add('theme-global-compass');
        }

    }, [user?.agencyId]);
}
