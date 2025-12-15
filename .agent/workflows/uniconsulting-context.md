---
description: UniConsulting project context and architecture reference
---

# UniConsulting Platform Memory

## Project Overview

UniConsulting is an AI-powered university application management platform connecting education consultants (teachers) with students applying to universities abroad.

## Target Users

- **Teachers/Consultants**: Manage student applications, approve accounts, communicate with students, use AI tools for university matching
- **Students**: Upload documents, write essays, receive AI feedback, communicate with assigned teacher

## Technology Stack

- **Frontend**: Next.js 15, React 19, TailwindCSS, TypeScript
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Desktop**: Electron with bundled React frontend (Vite)
- **AI**: Google Gemini Pro API
- **Deployment**: Netlify (web), Direct download (desktop)

## Key Features

1. AI Essay Review (Google Gemini)
2. AI University Matcher
3. Document OCR (passport/transcript extraction)
4. Real-time messaging
5. Application tracking (Kanban board)
6. Desktop app for teachers with browser automation

## File Structure

```
uniconsulting/
├── src/                        # Next.js web application
│   ├── app/                    # App Router pages
│   │   ├── (auth)/            # Auth layout (login, signup)
│   │   ├── student/           # Student dashboard pages
│   │   ├── teacher/           # Teacher dashboard pages
│   │   └── api/               # API routes
│   ├── components/            # Reusable React components
│   ├── hooks/                 # Custom React hooks
│   └── lib/                   # Utilities and configs
├── desktop-app/               # Electron desktop application
│   ├── main.js               # Electron main process
│   ├── preload.js            # Preload script
│   ├── src/src/              # React frontend (Vite)
│   ├── automation-service/   # Python browser automation
│   └── dist-react/           # Built frontend
├── supabase/                  # Supabase Edge Functions
│   └── functions/            # Serverless functions
├── sql/                       # Database schema files
└── public/                    # Static assets
```

## Database Tables (Supabase)

- **profiles**: User profiles with role (student/teacher), approval_status, teacher_id
- **documents**: Uploaded documents with OCR extracted_data
- **essays**: Student essays with AI feedback
- **essay_versions**: Version history for essays
- **messages**: Real-time messaging between users

## RLS Security Model

- All tables have RLS enabled
- Students can only access their own data
- Teachers can access their assigned students' data (via teacher_id FK)
- Admins have full access

## API Routes

- `/api/ai-essay-review` - AI essay feedback via Gemini
- `/api/document-ocr` - Passport/document parsing
- `/api/approve-student` - Student approval workflow
- `/api/update-stage` - Kanban stage update

## Desktop App Specifics

- Uses HashRouter for Electron compatibility
- Zustand for state management
- IPC only for: auth tokens, automation engine, auto-updater
- Data fetching uses Supabase directly (NOT IPC)
- Python FastAPI automation service on port 8765

## Common Development Commands

```bash
# Web app
npm run dev                    # Start Next.js dev server

# Desktop app
cd desktop-app
npm run dev                    # Start Electron with Vite
npm run build:teacher          # Build teacher installer

# Desktop frontend only
cd desktop-app/src
npm run build                  # Build React for Electron
```

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `GEMINI_API_KEY` - Google Gemini API key (server-side only)
