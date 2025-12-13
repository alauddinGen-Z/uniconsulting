/**
 * Static Export Build Script for Electron
 * 
 * This script temporarily moves incompatible folders during static export:
 * - /api routes (require server runtime)
 * - Dynamic routes like [studentId] (require generateStaticParams)
 * 
 * Usage: node build-static.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Folders to move during static export
const FOLDERS_TO_MOVE = [
    {
        src: path.join(__dirname, 'src', 'app', 'api'),
        backup: path.join(__dirname, 'src', 'app', '_api_backup'),
        name: '/api'
    },
    {
        src: path.join(__dirname, 'src', 'app', 'teacher', 'companion', '[studentId]'),
        backup: path.join(__dirname, 'src', 'app', 'teacher', 'companion', '_studentId_backup'),
        name: '[studentId]'
    }
];

const OUT_DIR = path.join(__dirname, 'out');

function log(msg) {
    console.log(`[Static Build] ${msg}`);
}

function restoreFolders() {
    for (const folder of FOLDERS_TO_MOVE) {
        if (fs.existsSync(folder.backup)) {
            log(`Restoring ${folder.name} folder...`);
            if (fs.existsSync(folder.src)) {
                fs.rmSync(folder.src, { recursive: true, force: true });
            }
            fs.renameSync(folder.backup, folder.src);
        }
    }
}

// Ensure folders are restored on exit, error, or interrupt
process.on('exit', restoreFolders);
process.on('SIGINT', () => { restoreFolders(); process.exit(1); });
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    restoreFolders();
    process.exit(1);
});

async function build() {
    try {
        // Step 1: Move incompatible folders
        for (const folder of FOLDERS_TO_MOVE) {
            if (fs.existsSync(folder.src)) {
                log(`Moving ${folder.name} folder temporarily...`);
                if (fs.existsSync(folder.backup)) {
                    fs.rmSync(folder.backup, { recursive: true, force: true });
                }
                fs.renameSync(folder.src, folder.backup);
            }
        }

        // Step 2: Clear any existing cache
        const nextDir = path.join(__dirname, '.next');
        if (fs.existsSync(nextDir)) {
            log('Clearing .next cache...');
            fs.rmSync(nextDir, { recursive: true, force: true });
        }

        // Step 3: Run Next.js static export
        log('Running Next.js static export...');
        execSync('npx next build', {
            stdio: 'inherit',
            env: { ...process.env, NEXT_PUBLIC_STATIC_EXPORT: 'true' }
        });

        log('Static export completed successfully!');

        // Check if out folder was created
        if (fs.existsSync(OUT_DIR)) {
            const items = fs.readdirSync(OUT_DIR);
            log(`✓ Created out/ with ${items.length} items`);
        } else {
            log('⚠ Warning: out/ folder not created');
        }

    } catch (error) {
        console.error('Build failed:', error.message);
        throw error;
    }
}

build().catch(() => process.exit(1));
