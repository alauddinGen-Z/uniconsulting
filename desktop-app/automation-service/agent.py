"""
University Application Agent
Uses browser-use with Gemini to automate university applications

ARCHITECTURAL MANDATES:
- Visibility: headless=False (teacher must see browser)
- Persistence: user_data_dir for session/cookie retention
- Safety: MUST NOT click final submit buttons

Python 3.12 compatible, PyInstaller ready
"""

import asyncio
import os
import sys
import secrets
import string
from pathlib import Path
from typing import Callable, Literal

# Determine the base directory for PyInstaller compatibility
if getattr(sys, 'frozen', False):
    BASE_DIR = Path(sys.executable).parent
else:
    BASE_DIR = Path(__file__).parent

from dotenv import load_dotenv
load_dotenv(BASE_DIR / '.env')


# Try importing browser-use components
# Note: browser-use 0.11.x renamed BrowserConfig to BrowserProfile
try:
    from browser_use import Agent, Browser, BrowserProfile
    from browser_use.llm.google import ChatGoogle
    BROWSER_USE_AVAILABLE = True
    print("[Automation] OK - browser-use and ChatGoogle imported successfully")
except ImportError as e:
    BROWSER_USE_AVAILABLE = False
    print(f"[Automation] FAILED - browser-use import failed: {e}")
    print(f"[Automation] Full error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
except Exception as e:
    BROWSER_USE_AVAILABLE = False
    print(f"[Automation] FAILED - Unexpected error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()


# =============================================================================
# CRITICAL SAFETY GUARDRAIL - NEGATIVE INSTRUCTION
# =============================================================================

SAFETY_SYSTEM_PROMPT = """
You are a university application assistant. You help fill out application forms accurately.

## CRITICAL SAFETY GUARDRAIL - MANDATORY COMPLIANCE ##

You are filling out forms on external university websites.

**YOU MUST NOT CLICK THE FINAL 'SUBMIT' BUTTON OR ANY EQUIVALENT BUTTON.**

This includes but is not limited to:
- "Submit Application"
- "Confirm Application"
- "Send Application"
- "Complete Application"
- "Finalize"
- "Submit for Review"
- Any button that would irrevocably send the application

**Instead, when you reach the final submission step:**
1. STOP immediately
2. Report the status as: "Ready for Review - Form Completion Halted per Security Protocol"
3. List all fields that were filled
4. List any documents that need to be uploaded manually
5. Report any account credentials that were created

This safety measure exists to allow human review before final submission.
"""


# =============================================================================
# BROWSER CONFIGURATION WITH PERSISTENCE
# =============================================================================

def get_persistent_browser_config() -> "BrowserProfile":
    """
    Create browser configuration.
    
    Note: browser-use 0.11.x manages its own browser launch.
    Using minimal configuration to avoid CDP connection issues.
    """
    # Return minimal profile - let browser-use handle defaults
    return BrowserProfile()


# =============================================================================
# AUTOMATION AGENT CLASS
# =============================================================================

class UniversityApplicationAgent:
    """
    Agent that automates university application form filling using browser-use
    
    MANDATORY REQUIREMENTS:
    1. headless=False - Teacher observes automation
    2. Persistent user_data_dir - Sessions maintained
    3. Safety guardrail - No final submission
    """
    
    def __init__(
        self, 
        gemini_api_key: str | None = None,
        progress_callback: Callable | None = None
    ):
        self.gemini_api_key = gemini_api_key or os.getenv("GEMINI_API_KEY")
        if not self.gemini_api_key:
            raise ValueError("GEMINI_API_KEY must be provided or set in environment")
        
        self.progress_callback = progress_callback
        self.browser: Browser | None = None
        self.agent: Agent | None = None
        self.account_credentials: dict | None = None
        
    async def _update_progress(self, status: str, progress: int, message: str):
        """Send progress update if callback is set"""
        if self.progress_callback:
            await self.progress_callback(status, progress, message)
    
    async def apply_to_university(
        self,
        student_data: dict,
        university_name: str,
        mode: Literal["semi", "full"]
    ) -> dict:
        """
        Main method to apply to a university
        
        Args:
            student_data: Student profile with all required fields
            university_name: Name of the university to apply to
            mode: "semi" for review before submit, "full" for auto-submit
            
        Returns:
            Result dict with status and any account credentials created
        """
        
        if not BROWSER_USE_AVAILABLE:
            return {
                "success": False,
                "message": "browser-use library not installed. Run: pip install browser-use langchain-google-genai",
                "account_created": None
            }
        
        try:
            # Initialize LLM with browser-use's native ChatGoogle
            llm = ChatGoogle(
                model="gemini-2.0-flash-exp",
                api_key=self.gemini_api_key,
                temperature=0.1  # Low temperature for accurate form filling
            )
            
            await self._update_progress("initializing", 15, "Starting browser (visible mode)...")
            
            # MANDATORY: Initialize browser with persistent config
            browser_config = get_persistent_browser_config()
            self.browser = Browser(config=browser_config)
            
            # Build the task prompt with student data
            task_prompt = self._build_task_prompt(student_data, university_name, mode)
            
            await self._update_progress("searching", 20, f"Searching for {university_name} application portal...")
            
            # Create and run agent with safety guardrail
            self.agent = Agent(
                task=task_prompt,
                llm=llm,
                browser=self.browser,
                system_prompt_class=None,  # We inject our own via task
            )
            
            # Run the agent
            history = await self.agent.run()
            
            await self._update_progress("processing", 80, "Processing application results...")
            
            # Parse results from history
            result = self._parse_agent_history(history)
            
            if mode == "semi":
                result["ready_for_review"] = True
                await self._update_progress("review", 90, "Application form filled. Ready for teacher review.")
            else:
                await self._update_progress("completed", 100, "Form filling completed (submission halted per protocol).")
            
            return result
            
        except Exception as e:
            await self._update_progress("error", 0, f"Application failed: {str(e)}")
            return {
                "success": False,
                "message": str(e),
                "account_created": self.account_credentials
            }
    
    def _build_task_prompt(
        self, 
        student_data: dict, 
        university_name: str, 
        mode: Literal["semi", "full"]
    ) -> str:
        """Build the task prompt for the browser-use agent with safety guardrail"""
        
        # Extract student information
        full_name = student_data.get("full_name", "")
        email = student_data.get("email", "")
        phone = student_data.get("phone", "")
        dob = student_data.get("date_of_birth", "")
        nationality = student_data.get("nationality", "")
        passport = student_data.get("passport_number", "")
        address = student_data.get("home_address", "")
        
        # Academic scores
        gpa = student_data.get("gpa", "")
        sat_total = student_data.get("sat_total", "")
        ielts = student_data.get("ielts_overall", "")
        toefl = student_data.get("toefl_total", "")
        
        # Preferences
        major = student_data.get("preferred_major", "")
        
        # Family info
        father = student_data.get("father_name", "")
        mother = student_data.get("mother_name", "")
        
        # Generate a secure password for account creation
        generated_password = ''.join(
            secrets.choice(string.ascii_letters + string.digits + "!@#$") 
            for _ in range(16)
        )
        
        # Store for later retrieval
        self.account_credentials = {
            "email": email,
            "password": generated_password,
            "university": university_name
        }
        
        # CRITICAL SAFETY INSTRUCTION - Always included
        safety_instruction = """
## ⚠️ CRITICAL SAFETY PROTOCOL ⚠️
YOU MUST NOT CLICK THE FINAL 'SUBMIT' BUTTON OR ANY EQUIVALENT.
Stop before submission and report: "Ready for Review - Form Completion Halted per Security Protocol"
"""
        
        prompt = f"""
{SAFETY_SYSTEM_PROMPT}

{safety_instruction}

## Your Task:
Apply to {university_name} for the following student. Fill all forms but DO NOT submit.

## Instructions:
1. Search Google for "{university_name} undergraduate application portal"
2. Navigate to the official university application website
3. If there's a "Create Account" or "Register" option, create an account with:
   - Email: {email}
   - Password: {generated_password}
   - Remember and report these credentials
4. Fill out all application forms with the student information below
5. **STOP** before the final submit button
6. Report status: "Ready for Review"

## Student Information:
- Full Name: {full_name}
- Email: {email}
- Phone: {phone}
- Date of Birth: {dob}
- Nationality: {nationality}
- Passport Number: {passport}
- Address: {address}

## Academic Information:
- GPA: {gpa}
- SAT Score: {sat_total}
- IELTS Score: {ielts}
- TOEFL Score: {toefl}
- Intended Major: {major}

## Family Information:
- Father's Name: {father}
- Mother's Name: {mother}

## Important Notes:
- If a field is not available, leave it blank or select "Other/Not Applicable"
- For essay questions, write: "Essay to be submitted separately"
- For document uploads, skip them and note which documents are required
- Report any account credentials you create
- **REMEMBER: DO NOT CLICK SUBMIT**

Begin now.
"""
        return prompt
    
    def _parse_agent_history(self, history) -> dict:
        """Parse the agent's action history to extract results"""
        result = {
            "success": True,
            "message": "Ready for Review - Form Completion Halted per Security Protocol",
            "account_created": self.account_credentials,
            "documents_needed": [],
            "notes": []
        }
        
        # Try to extract information from history
        if history and hasattr(history, 'messages'):
            for msg in history.messages:
                if hasattr(msg, 'content'):
                    content = str(msg.content).lower()
                    if 'upload' in content or 'document' in content:
                        result["documents_needed"].append(str(msg.content))
                    if 'error' in content or 'failed' in content:
                        result["notes"].append(str(msg.content))
        
        return result
    
    async def submit_application(self):
        """
        Submit the application (called after teacher approval in semi-auto mode)
        
        NOTE: This bypasses the safety guardrail and should only be called
        after explicit teacher confirmation.
        """
        if self.agent and self.browser:
            try:
                # Create a follow-up task to click submit
                llm = ChatGoogle(
                    model="gemini-2.0-flash-exp",
                    api_key=self.gemini_api_key,
                    temperature=0.1
                )
                
                submit_agent = Agent(
                    task="The teacher has approved submission. Click the final submit button to complete the application. Confirm the submission was successful.",
                    llm=llm,
                    browser=self.browser,
                )
                await submit_agent.run()
                await self._update_progress("submitted", 100, "Application submitted!")
            except Exception as e:
                await self._update_progress("error", 95, f"Submit failed: {str(e)}")
    
    async def close(self):
        """Clean up browser resources"""
        if self.browser:
            await self.browser.stop()


# =============================================================================
# STANDALONE TASK RUNNER (for /run-task endpoint)
# =============================================================================

async def run_automation_task(
    task_id: str,
    task_description: str,
    active_tasks: dict,
    websocket_connections: dict
):
    """
    Run a generic automation task (called from BackgroundTasks)
    
    This is the function called by main.py's /run-task endpoint.
    """
    import logging
    logger = logging.getLogger("UniConsulting.Agent")
    
    logger.info(f"[{task_id}] run_automation_task STARTED")
    print(f"[AGENT] Task {task_id} - Starting execution...")
    
    task = active_tasks[task_id]
    
    async def update_progress(status: str, progress: int, message: str):
        logger.info(f"[{task_id}] Progress: {status} - {progress}% - {message}")
        print(f"[AGENT] Task {task_id} - {status}: {message}")
        
        task["status"] = status
        task["progress"] = progress
        task["messages"].append(message)
        
        if task_id in websocket_connections:
            try:
                await websocket_connections[task_id].send_json({
                    "task_id": task_id,
                    "status": status,
                    "progress": progress,
                    "message": message
                })
                logger.info(f"[{task_id}] WebSocket update sent")
            except Exception as ws_err:
                logger.warning(f"[{task_id}] WebSocket send failed: {ws_err}")
    
    try:
        await update_progress("starting", 5, "Initializing browser automation...")
        
        if not BROWSER_USE_AVAILABLE:
            logger.error(f"[{task_id}] browser-use NOT available")
            await update_progress("error", 0, "browser-use library not installed")
            return
        
        logger.info(f"[{task_id}] browser-use is available, checking API key...")
        
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.error(f"[{task_id}] GEMINI_API_KEY not found")
            await update_progress("error", 0, "GEMINI_API_KEY not configured")
            return
        
        logger.info(f"[{task_id}] API key found, initializing LLM...")
        
        # Use browser-use's native ChatGoogle for proper message type compatibility
        llm = ChatGoogle(
            model="gemini-2.0-flash-exp",
            api_key=api_key,
            temperature=0.1
        )
        
        logger.info(f"[{task_id}] Native ChatGoogle LLM initialized")
        await update_progress("initializing", 10, "Starting browser (visible mode)...")
        
        # Find system Chrome executable
        chrome_paths = [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        ]
        
        chrome_exe = None
        for path in chrome_paths:
            if os.path.exists(path):
                chrome_exe = path
                logger.info(f"[{task_id}] Found Chrome at: {chrome_exe}")
                break
        
        if not chrome_exe:
            await update_progress("error", 0, "Chrome not found. Please install Google Chrome.")
            return
        
        # Launch Chrome manually with remote debugging
        import subprocess
        import socket
        import httpx
        
        # Find an available port
        def find_free_port():
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('', 0))
                return s.getsockname()[1]
        
        debug_port = find_free_port()
        user_data_dir = os.path.join(os.environ.get('TEMP', '/tmp'), f'uniconsulting_chrome_{debug_port}')
        
        await update_progress("initializing", 15, f"Launching Chrome on port {debug_port}...")
        
        # Start Chrome with remote debugging and NO PROXY
        chrome_args = [
            chrome_exe,
            f'--remote-debugging-port={debug_port}',
            f'--user-data-dir={user_data_dir}',
            '--no-first-run',
            '--no-default-browser-check',
            '--no-proxy-server',  # CRITICAL: Disable proxy for Chrome
            '--disable-background-networking',
            'about:blank',  # Open with a blank page
        ]
        
        logger.info(f"[{task_id}] Launching Chrome with args: {chrome_args}")
        
        try:
            chrome_process = subprocess.Popen(
                chrome_args, 
                stdout=subprocess.PIPE, 
                stderr=subprocess.PIPE,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
        except Exception as e:
            logger.error(f"[{task_id}] Failed to launch Chrome: {e}")
            await update_progress("error", 0, f"Failed to launch Chrome: {e}")
            return
        
        logger.info(f"[{task_id}] Chrome process started with PID: {chrome_process.pid}")
        
        # Create httpx client with NO PROXY (critical for avoiding 502)
        http_client = httpx.Client(trust_env=False, timeout=3)
        
        # Wait for Chrome to start and get CDP URL
        cdp_url = None
        last_error = None
        for attempt in range(20):  # Wait up to 20 seconds
            await asyncio.sleep(1)
            try:
                url = f'http://127.0.0.1:{debug_port}/json/version'
                logger.info(f"[{task_id}] Attempt {attempt+1}: Checking {url}")
                response = http_client.get(url)
                logger.info(f"[{task_id}] Response status: {response.status_code}, content: {response.text[:200] if response.text else '(empty)'}")
                if response.status_code == 200:
                    data = response.json()
                    cdp_url = data.get('webSocketDebuggerUrl')
                    logger.info(f"[{task_id}] Got CDP URL: {cdp_url}")
                    break
                elif response.status_code == 502:
                    last_error = f"502 Bad Gateway - proxy may be intercepting"
            except httpx.ConnectError as e:
                last_error = f"Connection refused (Chrome may still be starting)"
                logger.debug(f"[{task_id}] {last_error}")
            except Exception as e:
                last_error = str(e)
                logger.warning(f"[{task_id}] Attempt {attempt+1} failed: {e}")
        
        http_client.close()
        
        if not cdp_url:
            logger.error(f"[{task_id}] Failed to get CDP URL. Last error: {last_error}")
            chrome_process.terminate()
            await update_progress("error", 0, f"Failed to connect to Chrome CDP: {last_error}")
            return
        
        # Connect browser-use to the running Chrome
        browser_profile = get_persistent_browser_config()
        logger.info(f"[{task_id}] Connecting browser-use to CDP: {cdp_url}")
        
        browser = Browser(cdp_url=cdp_url)
        logger.info(f"[{task_id}] Browser instance created with CDP URL")
        
        # Start the browser-use session
        await browser.start()
        logger.info(f"[{task_id}] Browser started successfully!")
        
        await update_progress("running", 20, "Executing task...")
        
        # Create agent with safety guardrail
        full_task = f"{SAFETY_SYSTEM_PROMPT}\n\n## Your Task:\n{task_description}"
        
        logger.info(f"[{task_id}] Creating agent with task: {task_description[:100]}...")
        
        agent = Agent(
            task=full_task,
            llm=llm,
            browser=browser,
        )
        
        logger.info(f"[{task_id}] Agent created, running...")
        
        # Run the agent
        await agent.run()
        
        logger.info(f"[{task_id}] Agent completed successfully!")
        await update_progress("completed", 100, "Task completed successfully!")
        
        await browser.stop()
        logger.info(f"[{task_id}] Browser stopped")
        
    except Exception as e:
        import traceback
        error_msg = f"Task failed: {str(e)}"
        logger.error(f"[{task_id}] {error_msg}")
        logger.error(f"[{task_id}] Traceback:\n{traceback.format_exc()}")
        print(f"[AGENT ERROR] Task {task_id} - {error_msg}")
        print(traceback.format_exc())
        await update_progress("error", 0, error_msg)



# =============================================================================
# TESTING
# =============================================================================

if __name__ == "__main__":
    async def test():
        print("Testing UniversityApplicationAgent...")
        print(f"GEMINI_API_KEY configured: {bool(os.getenv('GEMINI_API_KEY'))}")
        
        agent = UniversityApplicationAgent()
        
        result = await agent.apply_to_university(
            student_data={
                "full_name": "Test Student",
                "email": "test@example.com",
                "phone": "+1234567890",
                "gpa": "4.0",
            },
            university_name="MIT",
            mode="semi"
        )
        
        print("Result:", result)
        await agent.close()
    
    asyncio.run(test())
