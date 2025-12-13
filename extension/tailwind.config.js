/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./src/**/*.{tsx,ts,jsx,js}"],
    theme: {
        extend: {
            colors: {
                // Match main app's UniConsulting theme (Orange)
                'brand-primary': {
                    50: '#fff7ed',
                    100: '#ffedd5',
                    200: '#fed7aa',
                    300: '#fdba74',
                    400: '#fb923c',
                    500: '#f97316',  // Orange-500 - Main brand color
                    600: '#ea580c',
                    700: '#c2410c',
                    800: '#9a3412',
                    900: '#7c2d12',
                },
                'brand-secondary': {
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
                'surface': {
                    base: '#0f172a',      // Slate-900
                    elevated: '#1e293b',  // Slate-800
                    overlay: '#334155',   // Slate-700
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
