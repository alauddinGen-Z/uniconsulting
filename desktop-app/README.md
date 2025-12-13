# UniConsulting Desktop App

Standalone Electron desktop application with AI-powered university application automation.

## Architecture

```
desktop-app/
├── main.js          # Electron main process (auto-updater, IPC)
├── preload.js       # Secure bridge to renderer
├── build-agent.js   # PyInstaller build script
├── python/
│   ├── agent.py     # Browser automation (browser-use)
│   └── requirements.txt
└── assets/          # App icons
```

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.8+ with pip
- Next.js app built (`npm run build` in root)

### Development

```bash
# 1. Build the Next.js app (from root)
cd ..
npm run build

# 2. Install desktop dependencies
cd desktop-app
npm install

# 3. Run in development mode
npm run dev
```

### Building for Distribution

```bash
# Build Python agent + Electron app
npm run dist

# Platform-specific builds
npm run dist:win    # Windows (.exe)
npm run dist:mac    # macOS (.dmg)
npm run dist:linux  # Linux (.AppImage)
```

## Environment Variables

Set in your system or `.env`:
- `GOOGLE_API_KEY` or `GEMINI_API_KEY` - For AI automation

## Auto-Updates

Uses `electron-updater` with GitHub Releases. Updates are checked on app startup.
