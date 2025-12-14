"""
Browser-Use Automation Service
FastAPI server for university application automation
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Literal
import asyncio
import uuid
import json
from datetime import datetime
from agent import UniversityApplicationAgent

app = FastAPI(title="UniConsulting Automation Service", version="1.0.0")

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


class ApplicationRequest(BaseModel):
    student_id: str
    student_data: dict  # Full student profile
    university_name: str
    mode: Literal["semi", "full"]  # semi = review before submit, full = auto submit
    gemini_api_key: str


class TaskStatus(BaseModel):
    task_id: str
    status: str
    progress: int
    message: str
    timestamp: str
    account_created: Optional[dict] = None  # Portal credentials if created


@app.get("/")
async def root():
    return {"status": "running", "service": "UniConsulting Automation"}


@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.post("/api/apply")
async def start_application(request: ApplicationRequest):
    """Start a university application automation task"""
    task_id = str(uuid.uuid4())
    
    # Store task info
    active_tasks[task_id] = {
        "status": "queued",
        "progress": 0,
        "request": request.model_dump(),
        "created_at": datetime.now().isoformat(),
        "messages": [],
        "account_credentials": None
    }
    
    # Start automation in background
    asyncio.create_task(run_automation(task_id, request))
    
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


async def run_automation(task_id: str, request: ApplicationRequest):
    """Run the browser-use automation"""
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
            except:
                pass
    
    try:
        await update_progress("starting", 5, "Initializing browser automation...")
        
        # Create agent
        agent = UniversityApplicationAgent(
            gemini_api_key=request.gemini_api_key,
            progress_callback=update_progress
        )
        
        await update_progress("searching", 10, f"Searching for {request.university_name} application portal...")
        
        # Run the automation
        result = await agent.apply_to_university(
            student_data=request.student_data,
            university_name=request.university_name,
            mode=request.mode
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
            
    except Exception as e:
        await update_progress("error", 0, f"Error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8765)
