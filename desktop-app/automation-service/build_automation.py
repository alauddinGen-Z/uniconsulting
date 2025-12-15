"""
PyInstaller build script for Automation Service
Compiles main.py + agent.py into a standalone Windows executable

Run from automation-service directory:
    python build_automation.py
"""

import subprocess
import sys
import os

def main():
    print("=" * 60)
    print("Building Automation Service with PyInstaller")
    print("=" * 60)
    
    # Ensure we're in the right directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    print(f"Working directory: {os.getcwd()}")
    
    # Install pyinstaller if not present
    try:
        import PyInstaller
        print(f"PyInstaller version: {PyInstaller.__version__}")
    except ImportError:
        print("Installing PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
    
    # PyInstaller command
    # --onedir creates a folder with all dependencies (faster startup than --onefile)
    # --name sets the output name
    # --add-data includes agent.py
    # --hidden-import includes dynamic imports
    
    # Comprehensive list of hidden imports for browser-use + langchain + playwright
    hidden_imports = [
        # Uvicorn internals
        "uvicorn.logging",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.http.h11_impl",
        "uvicorn.protocols.http.httptools_impl",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.protocols.websockets.websockets_impl",
        "uvicorn.protocols.websockets.wsproto_impl",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        "uvicorn.lifespan.off",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.loops.asyncio",
        
        # FastAPI / Starlette
        "fastapi",
        "fastapi.applications",
        "fastapi.routing",
        "fastapi.middleware",
        "starlette",
        "starlette.routing",
        "starlette.middleware",
        "starlette.middleware.cors",
        
        # Pydantic
        "pydantic",
        "pydantic.fields",
        "pydantic_core",
        
        # WebSockets
        "websockets",
        "websockets.legacy",
        "websockets.legacy.server",
        
        # Environment
        "dotenv",
        "python_dotenv",
        
        # Google AI / Gemini
        "google",
        "google.generativeai",
        "google.generativeai.types",
        "google.ai",
        "google.ai.generativelanguage",
        "google.api_core",
        "google.auth",
        "google.protobuf",
        
        # Langchain
        "langchain",
        "langchain_core",
        "langchain_core.language_models",
        "langchain_core.messages",
        "langchain_core.outputs",
        "langchain_google_genai",
        "langchain_google_genai.chat_models",
        
        # Browser-use and Playwright
        "browser_use",
        "browser_use.agent",
        "browser_use.agent.service",
        "browser_use.browser",
        "browser_use.browser.browser",
        "browser_use.browser.context",
        "browser_use.controller",
        "browser_use.dom",
        "browser_use.utils",
        "playwright",
        "playwright.sync_api",
        "playwright.async_api",
        "playwright._impl",
        "playwright._impl._browser",
        "playwright._impl._browser_context",
        "playwright._impl._page",
        
        # Additional async libraries
        "asyncio",
        "httpx",
        "httpcore",
        "anyio",
        "sniffio",
        "h11",
        "certifi",
        "charset_normalizer",
        "idna",
        "urllib3",
        
        # Playwright executable handling
        "greenlet",
        "pyee",
    ]
    
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onedir",
        "--name", "automation",
        "--noconfirm",
        "--clean",
        # Collect all data from these packages (includes Playwright browser driver info)
        "--collect-all", "browser_use",
        "--collect-all", "playwright",
        "--collect-all", "langchain_google_genai",
        "--collect-all", "google.generativeai",
    ]
    
    # Add all hidden imports
    for imp in hidden_imports:
        cmd.extend(["--hidden-import", imp])
    
    # Add data files
    cmd.extend([
        "--add-data", "agent.py;.",
    ])
    if os.path.exists(".env"):
        cmd.extend(["--add-data", ".env;."])
    
    # Entry point
    cmd.append("main.py")

    
    # Remove empty strings from cmd
    cmd = [c for c in cmd if c]
    
    print(f"\nCommand: {' '.join(cmd)}\n")
    
    try:
        subprocess.check_call(cmd)
        print("\n" + "=" * 60)
        print("✅ Build successful!")
        print(f"Output: dist/automation/automation.exe")
        
        # Copy .env file to dist folder if it exists
        import shutil
        env_src = os.path.join(script_dir, '.env')
        env_dst = os.path.join(script_dir, 'dist', 'automation', '.env')
        if os.path.exists(env_src):
            shutil.copy2(env_src, env_dst)
            print(f"✅ Copied .env to dist/automation/")
        else:
            print("⚠️  No .env file found - automation may not work without API keys")
        
        print("=" * 60)
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Build failed with code {e.returncode}")
        sys.exit(1)

if __name__ == "__main__":
    main()

