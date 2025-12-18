# UniConsulting

**Student Success Infrastructure for Education Agencies**

A full-stack B2B SaaS platform built with Next.js 16, Supabase, and AI-powered features.

---

## 🛠️ Tech Stack

*Detected from `package.json`:*

| Category | Package | Version | Purpose |
|----------|---------|---------|---------|
| **Framework** | `next` | ^16.0.7 | React Framework (App Router) |
| **React** | `react` | ^19.2.1 | UI Library |
| **Database** | `@supabase/supabase-js` | ^2.86.0 | Auth, DB, Realtime, Storage |
| **SSR Auth** | `@supabase/ssr` | ^0.8.0 | Server-side Supabase |
| **State** | `@tanstack/react-query` | ^5.90.12 | Server State Management |
| **Global State** | `zustand` | ^5.0.9 | Client State |
| **Kanban** | `@dnd-kit/core` | ^6.3.1 | Drag and Drop |
| **Kanban** | `@dnd-kit/sortable` | ^10.0.0 | Sortable Lists |
| **AI** | `@google/generative-ai` | ^0.24.1 | Gemini API |
| **Actions** | `next-safe-action` | ^8.0.11 | Type-safe Server Actions |
| **Validation** | `zod` | ^4.2.1 | Schema Validation |
| **Styling** | `tailwindcss` | ^4 | Utility CSS |
| **Animation** | `framer-motion` | ^12.23.24 | Motion Library |
| **Icons** | `lucide-react` | ^0.555.0 | Icon Library |
| **Toasts** | `sonner` | ^2.0.7 | Notifications |

---

## 📦 Installation

### Prerequisites
- Node.js 18+
- npm (detected from `package-lock.json`)
- Supabase Project

### 1. Clone Repository
```bash
git clone https://github.com/alauddinGen-Z/uniconsulting.git
cd uniconsulting
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables

Create `.env.local` in the project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Server-side Supabase (for admin operations)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key-here

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> ⚠️ **Never commit `.env.local` to version control!**

### 4. Database Setup

Run migrations in Supabase SQL Editor (in order):
```
1. sql/000_add_owner_role.sql
2. sql/001_init_multi_tenant.sql  
3. sql/fix_recursion_42P17.sql
4. sql/phase6_chat_security.sql
5. sql/phase9_scholarships.sql
```

### 5. Start Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🏗️ Architecture

### Route Structure

*Detected from `src/app`:*

```
src/app/
├── student/
│   ├── home/           # Student dashboard
│   ├── profile/        # Profile management
│   ├── application/    # Application tracking
│   ├── documents/      # Document uploads
│   ├── scholarships/   # 🤖 AI Scholarship Matcher (pgvector)
│   ├── messages/       # 💬 Real-time Chat
│   └── mentors/        # Mentor connections
│
├── teacher/
│   ├── home/           # Command Center
│   ├── students/       # Student list
│   ├── kanban/         # 📋 Drag-and-Drop Pipeline
│   ├── ai-matcher/     # 🤖 University Matcher AI
│   ├── messages/       # 💬 Real-time Chat
│   ├── admin/          # Admin panel
│   └── automation/     # Browser automation
│
├── chat/               # Chat actions
├── api/                # API routes (7 endpoints)
└── login/              # Authentication
```

### Supabase Edge Functions

*Detected from `supabase/functions`:*

| Function | Purpose |
|----------|---------|
| `ai-review` | Essay grading with Gemini 1.5 Pro |
| `document-ocr` | Passport/document text extraction |
| `university-matcher` | AI-powered university recommendations |

### Key Features

#### 1. Real-time Chat (`/student/messages`, `/teacher/messages`)
- Uses Supabase Realtime WebSocket subscriptions
- Participant-only access via RLS policies
- Optimistic message sending

#### 2. Kanban Board (`/teacher/kanban`)
- Powered by `@dnd-kit/core` and `@dnd-kit/sortable`
- Stages: Researching → Preparing → Submitted → Accepted/Rejected
- Optimistic updates with rollback on failure

#### 3. Scholarship Matcher (`/student/scholarships`)
- Vector search using Supabase pgvector
- Gemini embeddings for semantic matching
- Match percentage based on cosine similarity

#### 4. AI Essay Review (Edge Function)
- Deno runtime on Supabase Edge
- Gemini 1.5 Pro for analysis
- Structured JSON output (score, critique, improvements)

---

## � Deployment

### Netlify (Recommended)

*Detected `@netlify/plugin-nextjs` in devDependencies*

1. **Connect to Netlify**
   - Import from GitHub in Netlify Dashboard

2. **Build Settings**
   ```
   Build command: npm run build
   Publish directory: .next
   ```

3. **Environment Variables**
   - Add all `.env.local` variables in Site Settings

4. **netlify.toml** (already configured)
   ```toml
   [build]
     command = "npm run build"
     publish = ".next"

   [[plugins]]
     package = "@netlify/plugin-nextjs"
   ```

5. **Deploy**

### Vercel

1. Import project from GitHub
2. Framework: Next.js (auto-detected)
3. Add environment variables
4. Deploy

---

## 📝 Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint check
npm run build:export # Static export (custom)
```

---

## � Security

- **RLS Policies** on all tables (Row Level Security)
- **SECURITY DEFINER** functions to prevent recursion
- **next-safe-action** with Zod validation
- **Folder-based storage isolation**
- **Participant-only chat access**

---

## 📚 Documentation

- `README.md` - This file (Developer Guide)
- `CLIENT_MANUAL.md` - End-user documentation
- `CLAUDE.md` - AI context file
- `PROJECT_ARCHITECTURE.md` - Detailed architecture

---

## 📄 License

Proprietary - UniConsulting
