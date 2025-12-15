"""
Browser-Use Automation Service
FastAPI server for university application automation

ARCHITECTURAL MANDATES:
- Port: 8765 (MANDATORY)
- Non-blocking task execution via BackgroundTasks
- LLM: Google Gemini via langchain-google-genai
"""

import os
import sys
import logging
from datetime import datetime
from typing import Literal
from pathlib import Path

# Determine the base directory for PyInstaller compatibility
if getattr(sys, 'frozen', False):
    # Running as compiled exe
    BASE_DIR = Path(sys.executable).parent
else:
    # Running as script
    BASE_DIR = Path(__file__).parent

# Load environment variables from the correct location
from dotenv import load_dotenv
env_path = BASE_DIR / '.env'
load_dotenv(env_path)
print(f"[Automation] Loading .env from: {env_path} (exists: {env_path.exists()})")
print(f"[Automation] GEMINI_API_KEY configured: {bool(os.getenv('GEMINI_API_KEY'))}")

from fastapi import FastAPI, BackgroundTasks, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
import uuid

from agent import UniversityApplicationAgent, run_automation_task


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("UniConsulting.Automation")

# Initialize FastAPI application
app = FastAPI(
    title="UniConsulting Automation Service",
    version="2.0.0",
    description="Teacher-side browser automation for university applications"
)

# Allow CORS for Electron app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store active tasks and their WebSocket connections
active_tasks: dict[str, dict] = {}
websocket_connections: dict[str, WebSocket] = {}


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class TaskRequest(BaseModel):
    """Simple task request for /run-task endpoint (MANDATORY SPEC)"""
    task: str


class ApplicationRequest(BaseModel):
    """Full application request with student data"""
    student_id: str
    student_data: dict  # Full student profile
    university_name: str
    major: str | None = None  # Major/program to apply for
    mode: Literal["semi", "full"]  # semi = review before submit, full = auto submit
    gemini_api_key: str | None = None  # Optional, defaults to env var
    custom_prompt: str | None = None  # Optional pre-built prompt from frontend


class TaskStatus(BaseModel):
    """Task status response"""
    task_id: str
    status: str
    progress: int
    message: str
    timestamp: str
    account_created: dict | None = None


# =============================================================================
# ENDPOINTS
# =============================================================================

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "running",
        "service": "UniConsulting Automation",
        "port": 8765,
        "version": "2.0.0"
    }


@app.get("/health")
async def health():
    """Detailed health check"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY"))
    }


@app.post("/run-task")
async def run_task(request: TaskRequest):
    """
    MANDATORY ENDPOINT: /run-task
    
    CRITICAL NON-BLOCKING REQUIREMENT:
    Uses asyncio.create_task to offload execution.
    Returns immediately to prevent Electron main process from blocking.
    
    Input: {"task": "string"}
    Output: {"status": "Task Started", "task_description": "..."}
    """
    task_id = str(uuid.uuid4())
    task_description = request.task
    
    logger.info(f"[{task_id}] Received task: {task_description[:100]}...")
    
    # Store task info
    active_tasks[task_id] = {
        "status": "started",
        "progress": 0,
        "description": task_description,
        "created_at": datetime.now().isoformat(),
        "messages": ["Task queued for execution"],
        "account_credentials": None
    }
    
    # CRITICAL: Use asyncio.create_task for proper async execution
    # FastAPI BackgroundTasks doesn't work correctly with browser-use async code
    import asyncio
    asyncio.create_task(
        run_automation_task(
            task_id=task_id,
            task_description=task_description,
            active_tasks=active_tasks,
            websocket_connections=websocket_connections
        )
    )
    
    logger.info(f"[{task_id}] Task scheduled with asyncio.create_task")
    
    # Return IMMEDIATELY to prevent Electron blocking
    return {
        "status": "Task Started",
        "task_description": task_description,
        "task_id": task_id
    }


@app.post("/api/apply")
async def start_application(request: ApplicationRequest):
    """Start a university application automation task"""
    task_id = str(uuid.uuid4())
    
    # Get API key from request or environment
    api_key = request.gemini_api_key or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="GEMINI_API_KEY not configured")
    
    # Store task info
    active_tasks[task_id] = {
        "status": "queued",
        "progress": 0,
        "request": request.model_dump(),
        "created_at": datetime.now().isoformat(),
        "messages": [],
        "account_credentials": None
    }
    
    # Start automation with asyncio.create_task (non-blocking, works with async browser-use)
    import asyncio
    asyncio.create_task(
        run_application_automation(
            task_id,
            request,
            api_key
        )
    )
    
    return {"task_id": task_id, "status": "started"}


@app.get("/api/status/{task_id}")
async def get_status(task_id: str):
    """Get status of an automation task"""
    if task_id not in active_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = active_tasks[task_id]
    return TaskStatus(
        task_id=task_id,
        status=task["status"],
        progress=task["progress"],
        message=task["messages"][-1] if task["messages"] else "Waiting...",
        timestamp=datetime.now().isoformat(),
        account_created=task.get("account_credentials")
    )


@app.post("/api/confirm/{task_id}")
async def confirm_submission(task_id: str, action: Literal["submit", "cancel"]):
    """Confirm or cancel submission in semi-auto mode"""
    if task_id not in active_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = active_tasks[task_id]
    if task["status"] != "awaiting_confirmation":
        raise HTTPException(status_code=400, detail="Task not awaiting confirmation")
    
    task["user_action"] = action
    return {"status": "action_received", "action": action}


@app.websocket("/ws/progress/{task_id}")
async def websocket_progress(websocket: WebSocket, task_id: str):
    """WebSocket for real-time progress updates"""
    await websocket.accept()
    websocket_connections[task_id] = websocket
    
    try:
        while True:
            # Keep connection alive, send updates from task
            if task_id in active_tasks:
                task = active_tasks[task_id]
                await websocket.send_json({
                    "task_id": task_id,
                    "status": task["status"],
                    "progress": task["progress"],
                    "messages": task["messages"],
                    "account_credentials": task.get("account_credentials")
                })
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        if task_id in websocket_connections:
            del websocket_connections[task_id]


# =============================================================================
# BACKGROUND TASK RUNNERS
# =============================================================================

async def run_application_automation(task_id: str, request: ApplicationRequest, api_key: str):
    """Run the browser-use automation for university application"""
    task = active_tasks[task_id]
    
    async def update_progress(status: str, progress: int, message: str):
        task["status"] = status
        task["progress"] = progress
        task["messages"].append(message)
        
        # Send WebSocket update if connected
        if task_id in websocket_connections:
            try:
                await websocket_connections[task_id].send_json({
                    "task_id": task_id,
                    "status": status,
                    "progress": progress,
                    "message": message,
                    "account_credentials": task.get("account_credentials")
                })
            except Exception:
                pass
    
    try:
        await update_progress("starting", 5, "Initializing browser automation...")
        
        # Create agent
        agent = UniversityApplicationAgent(
            gemini_api_key=api_key,
            progress_callback=update_progress
        )
        
        await update_progress("searching", 10, f"Searching for {request.university_name} application portal...")
        
        # Run the automation with custom prompt if provided
        result = await agent.apply_to_university(
            student_data=request.student_data,
            university_name=request.university_name,
            major=request.major,
            mode=request.mode,
            custom_prompt=request.custom_prompt
        )
        
        if result.get("account_created"):
            task["account_credentials"] = result["account_created"]
        
        if request.mode == "semi" and result.get("ready_for_review"):
            await update_progress("awaiting_confirmation", 90, "Application filled. Awaiting teacher review...")
            
            # Wait for user confirmation
            while task.get("user_action") is None:
                await asyncio.sleep(1)
            
            if task["user_action"] == "submit":
                await agent.submit_application()
                await update_progress("completed", 100, "Application submitted successfully!")
            else:
                await update_progress("cancelled", 100, "Application cancelled by teacher.")
        else:
            await update_progress("completed", 100, result.get("message", "Application process completed!"))
        
        await agent.close()
            
    except Exception as e:
        logger.error(f"[{task_id}] Automation error: {str(e)}")
        await update_progress("error", 0, f"Error: {str(e)}")


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    
    logger.info("=" * 60)
    logger.info("UniConsulting Automation Service Starting...")
    logger.info(f"Port: 8765 (MANDATORY)")
    logger.info(f"GEMINI_API_KEY configured: {bool(os.getenv('GEMINI_API_KEY'))}")
    logger.info("=" * 60)
    
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8765,  # MANDATORY PORT
        log_level="info"
    )
