/**
 * Python Engine Build Script
 * 
 * Uses PyInstaller to compile engine.py into a standalone executable.
 * The resulting executable is bundled with the Electron app.
 * 
 * @file desktop-app/build-engine.js
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PYTHON_DIR = path.join(__dirname, 'python');
const ENGINE_SCRIPT = path.join(PYTHON_DIR, 'engine.py');

function log(message) {
    console.log(`[Build] ${message}`);
}

function runCommand(command, args, cwd) {
    return new Promise((resolve, reject) => {
        log(`Running: ${command} ${args.join(' ')}`);

        const proc = spawn(command, args, {
            cwd,
            stdio: 'inherit',
            shell: true,
        });

        proc.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with code ${code}`));
            }
        });

        proc.on('error', reject);
    });
}

async function main() {
    log('='.repeat(60));
    log('UniConsulting Engine Build Script');
    log('='.repeat(60));

    // Check if engine.py exists
    if (!fs.existsSync(ENGINE_SCRIPT)) {
        log(`Error: ${ENGINE_SCRIPT} not found`);
        process.exit(1);
    }

    // Step 1: Install Python dependencies
    log('');
    log('[1/4] Installing Python dependencies...');
    try {
        await runCommand('pip', ['install', '-r', 'requirements.txt'], PYTHON_DIR);
    } catch (error) {
        log(`Warning: Failed to install requirements - ${error.message}`);
        log('Continuing with PyInstaller...');
    }

    // Step 2: Install PyInstaller
    log('');
    log('[2/4] Ensuring PyInstaller is installed...');
    try {
        await runCommand('pip', ['install', 'pyinstaller'], PYTHON_DIR);
    } catch (error) {
        log(`Error: Failed to install PyInstaller - ${error.message}`);
        process.exit(1);
    }

    // Step 3: Install Playwright browsers (required by browser-use)
    log('');
    log('[3/4] Installing Playwright browsers...');
    try {
        await runCommand('python', ['-m', 'playwright', 'install', 'chromium'], PYTHON_DIR);
    } catch (error) {
        log(`Warning: Playwright install failed - ${error.message}`);
        log('Browser automation may not work without Playwright browsers');
    }

    // Step 4: Build with PyInstaller
    log('');
    log('[4/4] Building executable with PyInstaller...');
    try {
        await runCommand('python', [
            '-m', 'PyInstaller',
            '--onedir',
            '--name=engine',
            '--distpath=dist',
            '--workpath=build',
            '--specpath=build',
            '--clean',
            '--noconfirm',
            // Include browser-use and its dependencies
            '--collect-all=browser_use',
            '--collect-all=langchain_google_genai',
            '--collect-all=playwright',
            '--hidden-import=playwright.sync_api',
            '--hidden-import=playwright.async_api',
            'engine.py',
        ], PYTHON_DIR);
    } catch (error) {
        log(`Error: PyInstaller build failed - ${error.message}`);
        process.exit(1);
    }

    log('');
    log('='.repeat(60));
    log('Build Complete!');
    log(`Executable: ${path.join(PYTHON_DIR, 'dist', 'engine')}`);
    log('='.repeat(60));
}

main().catch((error) => {
    log(`Build failed: ${error.message}`);
    process.exit(1);
});
