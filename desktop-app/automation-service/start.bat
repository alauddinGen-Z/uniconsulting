@echo off
echo Starting UniConsulting Automation Service...
echo.

:: Activate virtual environment
call venv\Scripts\activate.bat

:: Start the server
python main.py
