"""
UniConsulting Automation Agent

Uses browser-use library to automate university application form filling.
Receives student data via stdin (JSON) and launches browser automation.

Repository: https://github.com/browser-use/browser-use

@file desktop-app/python/agent.py
"""

import sys
import json
import asyncio
import logging
from typing import Optional, Dict, Any

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[Agent] %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)


def log(message: str):
    """Print a log message with flush for real-time streaming."""
    print(f"[Agent] {message}", flush=True)


try:
    from browser_use import Agent
    from langchain_google_genai import ChatGoogleGenerativeAI
    BROWSER_USE_AVAILABLE = True
except ImportError as e:
    BROWSER_USE_AVAILABLE = False
    log(f"Warning: browser-use not available - {e}")
    log("Install with: pip install browser-use langchain-google-genai")


def format_student_info(student: Dict[str, Any]) -> str:
    """Format student profile into a readable string for the AI."""
    fields = [
        ("Full Name", student.get("full_name")),
        ("Email", student.get("email")),
        ("Phone", student.get("phone")),
        ("Date of Birth", student.get("date_of_birth")),
        ("Nationality", student.get("nationality")),
        ("Passport Number", student.get("passport_number")),
        ("Address", student.get("address")),
        ("City", student.get("city")),
        ("Country", student.get("country")),
        ("Postal Code", student.get("postal_code")),
        ("High School Name", student.get("high_school_name")),
        ("GPA", student.get("gpa")),
        ("Graduation Year", student.get("graduation_year")),
        ("SAT Score", student.get("sat_score")),
        ("ACT Score", student.get("act_score")),
        ("IELTS Overall", student.get("ielts_overall")),
        ("TOEFL Score", student.get("toefl_score")),
        ("Parent Name", student.get("parent_name")),
        ("Parent Email", student.get("parent_email")),
        ("Parent Phone", student.get("parent_phone")),
    ]
    
    lines = []
    for label, value in fields:
        if value is not None and value != "":
            lines.append(f"- {label}: {value}")
    
    return "\n".join(lines)


async def run_automation(student: Dict[str, Any], university_url: Optional[str] = None):
    """
    Run the browser automation to fill university application.
    
    Args:
        student: Student profile data dictionary
        university_url: Optional specific URL to navigate to
    """
    if not BROWSER_USE_AVAILABLE:
        log("Error: browser-use library not installed")
        return {"success": False, "error": "browser-use not installed"}
    
    log("Initializing AI model (Google Gemini 2.0 Flash)...")
    
    try:
        # Initialize the LLM
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash-exp",
            temperature=0.1,
        )
        
        # Format student information
        student_info = format_student_info(student)
        log(f"Student profile loaded: {student.get('full_name', 'Unknown')}")
        
        # Create the automation task
        task = f"""
You are an expert at filling out university application forms accurately and efficiently.

STUDENT INFORMATION:
{student_info}

YOUR TASK:
1. {"Navigate to: " + university_url if university_url else "You are already on the application page"}
2. Carefully analyze each form field on the page
3. Match form fields to the student information provided above
4. Fill in all matching fields accurately
5. For dropdown/select fields, choose the closest matching option
6. Leave fields empty if no matching student data exists
7. DO NOT submit the form - just fill it out and stop

IMPORTANT RULES:
- Be precise with data entry
- Double-check date formats (use the format the form expects)
- For phone numbers, include country code if available
- Click any "Next" or "Continue" buttons to reveal more fields
- Report your progress as you work
- Stop when you've filled all available fields or reached a submission page

Begin by describing what you see on the current page.
"""
        
        log("Creating browser automation agent...")
        agent = Agent(
            task=task,
            llm=llm,
        )
        
        log("Starting browser automation...")
        log("-" * 50)
        
        # Run the agent
        result = await agent.run()
        
        log("-" * 50)
        log("Automation completed successfully!")
        
        return {
            "success": True,
            "result": str(result),
            "message": "Form filling completed"
        }
        
    except Exception as e:
        error_msg = str(e)
        log(f"Automation error: {error_msg}")
        return {
            "success": False,
            "error": error_msg
        }


def main():
    """Main entry point - reads input from stdin."""
    log("UniConsulting Automation Agent v1.0")
    log("=" * 50)
    
    # Read input from stdin
    try:
        input_data = sys.stdin.read()
        if not input_data.strip():
            log("Error: No input data received")
            print(json.dumps({"success": False, "error": "No input data"}))
            sys.exit(1)
        
        data = json.loads(input_data)
        student = data.get("student", {})
        university_url = data.get("url")
        
        log(f"Received data for: {student.get('full_name', 'Unknown Student')}")
        if university_url:
            log(f"Target URL: {university_url}")
        
    except json.JSONDecodeError as e:
        log(f"Error: Invalid JSON input - {e}")
        print(json.dumps({"success": False, "error": f"Invalid JSON: {e}"}))
        sys.exit(1)
    
    # Run automation
    log("")
    result = asyncio.run(run_automation(student, university_url))
    
    # Output result as JSON
    print(json.dumps(result), flush=True)
    
    # Exit with appropriate code
    sys.exit(0 if result.get("success") else 1)


if __name__ == "__main__":
    main()
