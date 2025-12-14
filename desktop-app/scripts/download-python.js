/**
 * Download Portable Python for Bundling
 * 
 * This script downloads Python 3.11 embeddable package and sets it up
 * for bundling with the Electron app.
 * 
 * Run: node scripts/download-python.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Python 3.11.9 embeddable package for Windows x64
const PYTHON_VERSION = '3.11.9';
const PYTHON_URL = `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip`;
const GET_PIP_URL = 'https://bootstrap.pypa.io/get-pip.py';

const DOWNLOAD_DIR = path.join(__dirname, '..', 'python-embedded');
const ZIP_PATH = path.join(DOWNLOAD_DIR, 'python-embed.zip');

async function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        console.log(`Downloading: ${url}`);
        const file = fs.createWriteStream(destPath);

        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Follow redirect
                https.get(response.headers.location, (redirectResponse) => {
                    redirectResponse.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });
                }).on('error', reject);
            } else {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            }
        }).on('error', (err) => {
            fs.unlink(destPath, () => { });
            reject(err);
        });
    });
}

async function extractZip(zipPath, destDir) {
    console.log(`Extracting to: ${destDir}`);
    // Use PowerShell to extract on Windows
    if (process.platform === 'win32') {
        execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, { stdio: 'inherit' });
    } else {
        execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: 'inherit' });
    }
}

async function setupPip(pythonDir) {
    const pythonExe = path.join(pythonDir, 'python.exe');
    const getPipPath = path.join(pythonDir, 'get-pip.py');

    // Download get-pip.py
    await downloadFile(GET_PIP_URL, getPipPath);

    // Modify python311._pth to enable site-packages
    const pthFile = path.join(pythonDir, 'python311._pth');
    if (fs.existsSync(pthFile)) {
        let content = fs.readFileSync(pthFile, 'utf-8');
        // Uncomment import site
        content = content.replace('#import site', 'import site');
        // Add Lib/site-packages
        if (!content.includes('Lib/site-packages')) {
            content += '\nLib/site-packages\n';
        }
        fs.writeFileSync(pthFile, content);
        console.log('Modified python311._pth to enable pip');
    }

    // Install pip
    console.log('Installing pip...');
    execSync(`"${pythonExe}" "${getPipPath}" --no-warn-script-location`, {
        stdio: 'inherit',
        cwd: pythonDir
    });

    // Clean up
    fs.unlinkSync(getPipPath);
}

async function main() {
    console.log('===========================================');
    console.log('Portable Python Downloader for UniConsulting');
    console.log('===========================================\n');

    // Create download directory
    if (!fs.existsSync(DOWNLOAD_DIR)) {
        fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }

    // Check if already downloaded
    const pythonExe = path.join(DOWNLOAD_DIR, 'python.exe');
    if (fs.existsSync(pythonExe)) {
        console.log('Python already downloaded. Delete python-embedded folder to re-download.');
        return;
    }

    try {
        // Download Python embeddable
        await downloadFile(PYTHON_URL, ZIP_PATH);
        console.log('Download complete!');

        // Extract
        await extractZip(ZIP_PATH, DOWNLOAD_DIR);
        console.log('Extraction complete!');

        // Remove zip
        fs.unlinkSync(ZIP_PATH);

        // Setup pip
        await setupPip(DOWNLOAD_DIR);

        console.log('\n✅ Portable Python setup complete!');
        console.log(`Location: ${DOWNLOAD_DIR}`);

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();
