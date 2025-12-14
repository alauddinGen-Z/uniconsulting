@echo off
echo ==========================================
echo UniConsulting Automation Service Installer
echo ==========================================
echo.

:: Check if Python is installed
python --version > nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed!
    echo Please install Python 3.11 or higher from https://python.org
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)

echo [1/3] Creating virtual environment...
python -m venv venv
if errorlevel 1 (
    echo ERROR: Failed to create virtual environment
    pause
    exit /b 1
)

echo [2/3] Activating virtual environment...
call venv\Scripts\activate.bat

echo [3/3] Installing dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [+] Installing browser-use Chromium...
uvx browser-use install 2>nul || python -m browser_use install 2>nul || echo Skipping Chromium install

echo.
echo ==========================================
echo Installation Complete!
echo ==========================================
echo.
echo To start the automation service, run: start.bat
echo.
pause
