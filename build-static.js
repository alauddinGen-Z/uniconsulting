/**
 * Static Export Build Script for Electron
 * 
 * This script temporarily moves the /api folder out of the way
 * during static export, then restores it after.
 * 
 * API routes are NOT compatible with Next.js static export.
 * The desktop app uses Supabase Edge Functions instead.
 * 
 * Usage: node build-static.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, 'src', 'app', 'api');
const API_BACKUP_DIR = path.join(__dirname, 'src', 'app', '_api_backup');
const DYNAMIC_ROUTE_DIR = path.join(__dirname, 'src', 'app', 'teacher', 'companion', '[studentId]');
const DYNAMIC_ROUTE_BACKUP = path.join(__dirname, 'src', 'app', 'teacher', 'companion', '_studentId_backup');

function log(msg) {
    console.log(`[Static Build] ${msg}`);
}

async function build() {
    let apiMoved = false;
    let dynamicMoved = false;

    try {
        // Step 1: Move API folder out of the way
        if (fs.existsSync(API_DIR)) {
            log('Moving /api folder temporarily...');
            fs.renameSync(API_DIR, API_BACKUP_DIR);
            apiMoved = true;
        }

        // Step 2: Move dynamic route folder out of the way
        if (fs.existsSync(DYNAMIC_ROUTE_DIR)) {
            log('Moving dynamic route [studentId] temporarily...');
            fs.renameSync(DYNAMIC_ROUTE_DIR, DYNAMIC_ROUTE_BACKUP);
            dynamicMoved = true;
        }

        // Step 3: Run Next.js static export
        log('Running Next.js static export...');
        process.env.NEXT_PUBLIC_STATIC_EXPORT = 'true';
        execSync('npx next build', {
            stdio: 'inherit',
            env: { ...process.env, NEXT_PUBLIC_STATIC_EXPORT: 'true' }
        });

        log('Static export completed successfully!');
        log(`Output folder: ${path.join(__dirname, 'out')}`);

    } catch (error) {
        console.error('Build failed:', error.message);
        process.exit(1);
    } finally {
        // Step 4: ALWAYS restore API folder
        if (apiMoved && fs.existsSync(API_BACKUP_DIR)) {
            log('Restoring /api folder...');
            fs.renameSync(API_BACKUP_DIR, API_DIR);
        }

        // Step 5: ALWAYS restore dynamic route folder
        if (dynamicMoved && fs.existsSync(DYNAMIC_ROUTE_BACKUP)) {
            log('Restoring [studentId] folder...');
            fs.renameSync(DYNAMIC_ROUTE_BACKUP, DYNAMIC_ROUTE_DIR);
        }
    }
}

build();
