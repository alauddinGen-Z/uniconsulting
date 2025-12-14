"""
University Application Agent
Uses browser-use with Gemini to automate university applications
"""

import asyncio
from typing import Callable, Optional, Literal
import os
from dotenv import load_dotenv

load_dotenv()

# Try importing browser-use components
try:
    from browser_use import Agent, Browser
    from langchain_google_genai import ChatGoogleGenerativeAI
    BROWSER_USE_AVAILABLE = True
except ImportError:
    BROWSER_USE_AVAILABLE = False
    print("Warning: browser-use not installed. Run: pip install browser-use langchain-google-genai")


class UniversityApplicationAgent:
    """
    Agent that automates university application form filling using browser-use
    """
    
    def __init__(
        self, 
        gemini_api_key: str,
        progress_callback: Optional[Callable] = None
    ):
        self.gemini_api_key = gemini_api_key
        self.progress_callback = progress_callback
        self.browser: Optional[Browser] = None
        self.agent: Optional[Agent] = None
        self.account_credentials: Optional[dict] = None
        
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
                "message": "browser-use library not installed",
                "account_created": None
            }
        
        try:
            # Initialize LLM with Gemini
            llm = ChatGoogleGenerativeAI(
                model="gemini-2.0-flash-exp",
                google_api_key=self.gemini_api_key,
                temperature=0.1  # Low temperature for accurate form filling
            )
            
            await self._update_progress("initializing", 15, "Starting browser...")
            
            # Initialize browser
            self.browser = Browser()
            
            # Build the task prompt with student data
            task_prompt = self._build_task_prompt(student_data, university_name, mode)
            
            await self._update_progress("searching", 20, f"Searching for {university_name} application portal...")
            
            # Create and run agent
            self.agent = Agent(
                task=task_prompt,
                llm=llm,
                browser=self.browser,
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
                await self._update_progress("completed", 100, "Application submitted successfully!")
            
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
        """Build the task prompt for the browser-use agent"""
        
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
        import secrets
        import string
        generated_password = ''.join(secrets.choice(string.ascii_letters + string.digits + "!@#$") for _ in range(16))
        
        # Store for later retrieval
        self.account_credentials = {
            "email": email,
            "password": generated_password,
            "university": university_name
        }
        
        submit_instruction = ""
        if mode == "semi":
            submit_instruction = "DO NOT click the final submit button. Stop before submission and report that the form is ready for review."
        else:
            submit_instruction = "After filling all forms, click submit to complete the application."
        
        prompt = f"""
You are an expert university application assistant. Your task is to apply to {university_name} for a student.

## Instructions:
1. Search Google for "{university_name} undergraduate application portal" or "{university_name} admission apply online"
2. Navigate to the official university application website
3. If there's a "Create Account" or "Register" option, create an account with:
   - Email: {email}
   - Password: {generated_password}
   - Remember this password for reporting
4. Fill out all application forms with the student information below
5. {submit_instruction}

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
- For essay questions, write a brief placeholder: "Essay to be submitted separately"
- For document uploads, skip them and note which documents are required
- Report any account credentials you create

Begin the application process now.
"""
        return prompt
    
    def _parse_agent_history(self, history) -> dict:
        """Parse the agent's action history to extract results"""
        # Extract relevant information from history
        # This will depend on browser-use's history format
        
        result = {
            "success": True,
            "message": "Application form filled successfully",
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
        """Submit the application (called after teacher approval in semi-auto mode)"""
        if self.agent and self.browser:
            try:
                # Create a follow-up task to click submit
                submit_agent = Agent(
                    task="Click the final submit button to complete the application. Confirm the submission.",
                    llm=self.agent.llm,
                    browser=self.browser,
                )
                await submit_agent.run()
                await self._update_progress("submitted", 100, "Application submitted!")
            except Exception as e:
                await self._update_progress("error", 95, f"Submit failed: {str(e)}")
    
    async def close(self):
        """Clean up browser resources"""
        if self.browser:
            await self.browser.close()


# For testing
if __name__ == "__main__":
    async def test():
        agent = UniversityApplicationAgent(
            gemini_api_key=os.getenv("GEMINI_API_KEY", "")
        )
        
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
