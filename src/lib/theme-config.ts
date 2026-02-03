/**
 * Brand Theme Configuration
 * 
 * Centralized theme configuration for white-labeling support.
 * Edit this file to change the entire app's color scheme.
 * 
 * @file src/lib/theme-config.ts
 */

// Available brand presets
export type BrandPreset = 'uniconsulting' | 'global-compass' | 'custom';

// Theme configuration interface
export interface ThemeConfig {
    name: string;

    // Primary brand colors
    primary: {
        50: string;
        100: string;
        200: string;
        300: string;
        400: string;
        500: string;  // Main brand color
        600: string;
        700: string;
        800: string;
        900: string;
    };

    // Secondary/accent colors
    secondary: {
        50: string;
        100: string;
        200: string;
        300: string;
        400: string;
        500: string;
        600: string;
        700: string;
        800: string;
        900: string;
    };

    // Surface/background colors
    surface: {
        base: string;      // Main background
        elevated: string;  // Cards, modals
        overlay: string;   // Overlays, dropdowns
    };

    // Branding
    branding: {
        logoText: string;
        logoIcon: string;
        tagline: string;
    };
}

// ============================================================================
// BRAND PRESETS
// ============================================================================

/**
 * Original UniConsulting theme (Orange)
 */
export const UNICONSULTING_THEME: ThemeConfig = {
    name: 'UniConsulting',
    primary: {
        50: '#fff7ed',
        100: '#ffedd5',
        200: '#fed7aa',
        300: '#fdba74',
        400: '#fb923c',
        500: '#f97316',  // Orange-500
        600: '#ea580c',
        700: '#c2410c',
        800: '#9a3412',
        900: '#7c2d12',
    },
    secondary: {
        50: '#fdf2f8',
        100: '#fce7f3',
        200: '#fbcfe8',
        300: '#f9a8d4',
        400: '#f472b6',
        500: '#ec4899',  // Pink-500
        600: '#db2777',
        700: '#be185d',
        800: '#9d174d',
        900: '#831843',
    },
    surface: {
        base: '#0f172a',      // Slate-900
        elevated: '#1e293b',  // Slate-800
        overlay: '#334155',   // Slate-700
    },
    branding: {
        logoText: 'UNICONSULTING',
        logoIcon: 'U',
        tagline: 'Global Student Success',
    },
};

/**
 * Global Compass theme (Blue) - Enterprise Client
 */
export const GLOBAL_COMPASS_THEME: ThemeConfig = {
    name: 'Global Compass',
    primary: {
        50: '#eff6ff',
        100: '#dbeafe',
        200: '#bfdbfe',
        300: '#93c5fd',
        400: '#60a5fa',
        500: '#3b82f6',  // Blue-500
        600: '#2563eb',
        700: '#1d4ed8',
        800: '#1e40af',
        900: '#1e3a8a',
    },
    secondary: {
        50: '#f0fdf4',
        100: '#dcfce7',
        200: '#bbf7d0',
        300: '#86efac',
        400: '#4ade80',
        500: '#22c55e',  // Green-500
        600: '#16a34a',
        700: '#15803d',
        800: '#166534',
        900: '#14532d',
    },
    surface: {
        base: '#0f172a',      // Slate-900
        elevated: '#1e293b',  // Slate-800
        overlay: '#334155',   // Slate-700
    },
    branding: {
        logoText: 'COMPASS',
        logoIcon: 'G',
        tagline: 'Global Education',
    },
};

// ============================================================================
// ACTIVE THEME CONFIGURATION
// ============================================================================

/**
 * CHANGE THIS TO SWITCH THEMES
 * Options: UNICONSULTING_THEME, GLOBAL_COMPASS_THEME, or create custom
 */
export const ACTIVE_THEME: ThemeConfig = UNICONSULTING_THEME;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get CSS custom properties for the active theme
 * Inject these into :root or a theme provider
 */
export function getThemeCSSVariables(theme: ThemeConfig = ACTIVE_THEME): string {
    return `
        --brand-primary-50: ${theme.primary[50]};
        --brand-primary-100: ${theme.primary[100]};
        --brand-primary-200: ${theme.primary[200]};
        --brand-primary-300: ${theme.primary[300]};
        --brand-primary-400: ${theme.primary[400]};
        --brand-primary-500: ${theme.primary[500]};
        --brand-primary-600: ${theme.primary[600]};
        --brand-primary-700: ${theme.primary[700]};
        --brand-primary-800: ${theme.primary[800]};
        --brand-primary-900: ${theme.primary[900]};
        
        --brand-secondary-50: ${theme.secondary[50]};
        --brand-secondary-100: ${theme.secondary[100]};
        --brand-secondary-200: ${theme.secondary[200]};
        --brand-secondary-300: ${theme.secondary[300]};
        --brand-secondary-400: ${theme.secondary[400]};
        --brand-secondary-500: ${theme.secondary[500]};
        --brand-secondary-600: ${theme.secondary[600]};
        --brand-secondary-700: ${theme.secondary[700]};
        --brand-secondary-800: ${theme.secondary[800]};
        --brand-secondary-900: ${theme.secondary[900]};
        
        --surface-base: ${theme.surface.base};
        --surface-elevated: ${theme.surface.elevated};
        --surface-overlay: ${theme.surface.overlay};
    `.trim();
}

/**
 * Get Tailwind-compatible color object for extending theme
 */
export function getTailwindColors(theme: ThemeConfig = ACTIVE_THEME) {
    return {
        'brand-primary': theme.primary,
        'brand-secondary': theme.secondary,
        'surface': theme.surface,
    };
}
