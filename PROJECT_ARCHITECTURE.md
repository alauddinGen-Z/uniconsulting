# UniConsulting - Project Architecture

> **For AI Models**: This document provides a complete overview of the project structure to enable efficient code understanding and modifications.

## Project Overview

**UniConsulting** is a university consulting web application built with **Next.js 14** and **Supabase**. It connects students with teacher consultants for university application guidance.

### Core Tech Stack
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS v4, Framer Motion
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, Edge Functions)
- **Deployment**: Vercel (planned)

---

## User Roles

| Role | Description |
|------|-------------|
| **Student** | Fills profile, uploads documents, writes essays, chats with teacher |
| **Teacher** | Approves students, views applications, manages Kanban board, chats |

---

## Folder Structure

```
uniconsulting/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API routes
│   │   │   └── approve-student/  # Student approval (auto-creates chat)
│   │   ├── login/              # Login page
│   │   ├── student/            # Student pages
│   │   │   └── dashboard/      # Main student dashboard
│   │   └── teacher/            # Teacher pages
│   │       ├── dashboard/      # Main teacher dashboard
│   │       └── companion/      # Student detail view
│   │
│   ├── components/             # React components
│   │   ├── student/            # Student-specific components
│   │   │   ├── tabs/           # Tab content (Identity, Family, Academic, Essays)
│   │   │   ├── DashboardSidebar.tsx
│   │   │   ├── HomeDashboard.tsx
│   │   │   ├── ProfilePage.tsx      # Identity + Family combined
│   │   │   ├── ApplicationPage.tsx  # Universities + Academic + Essays combined
│   │   │   └── DocumentsTabPage.tsx
│   │   ├── teacher/            # Teacher-specific components
│   │   │   ├── automation/     # Automation tools
│   │   │   ├── TeacherSidebar.tsx
│   │   │   ├── TeacherHomeDashboard.tsx
│   │   │   ├── StudentListView.tsx
│   │   │   └── KanbanBoard.tsx
│   │   ├── chat/               # Chat system
│   │   │   └── ChatView.tsx    # Real-time messaging
│   │   └── shared/             # Shared components
│   │       ├── ProfileModal.tsx
│   │       └── SettingsModal.tsx
│   │
│   ├── contexts/               # React contexts
│   │   └── TeacherDataContext.tsx  # Shared teacher data
│   │
│   ├── lib/                    # Utilities & config (NEW)
│   │   ├── constants.ts        # App constants
│   │   └── config.ts           # Configuration
│   │
│   ├── types/                  # TypeScript types (NEW)
│   │   ├── database.types.ts   # Supabase table types
│   │   └── index.ts            # Re-exports
│   │
│   └── utils/                  # Supabase clients
│       └── supabase/
│           ├── client.ts       # Browser client
│           └── server.ts       # Server client
│
├── supabase/                   # Supabase Edge Functions
│   └── functions/
│       └── ai-review/          # AI essay review (Gemini)
│
├── sql/                        # Database migration scripts
│   ├── database.sql            # Main schema
│   ├── add_*.sql               # Feature additions
│   └── fix_*.sql               # Bug fixes & patches
│
└── public/                     # Static assets
```

---

## Database Schema (Supabase)

### Core Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (students & teachers) |
| `documents` | Uploaded student documents |
| `essays` | Student essays with AI feedback |
| `universities` | Student target universities |
| `academic_scores` | IELTS, GPA scores |

### Chat Tables

| Table | Purpose |
|-------|---------|
| `conversations` | Chat conversations (direct/group) |
| `conversation_participants` | Users in each conversation |
| `messages` | Chat messages |

### Key Columns in `profiles`

```sql
id              UUID PRIMARY KEY
role            TEXT ('student' | 'teacher')
approval_status TEXT ('pending' | 'approved' | 'rejected')
teacher_id      UUID (FK to teacher's profile)
full_name       TEXT
email           TEXT
```

---

## Key Features & Files

### 1. Student Approval Flow
- **File**: `src/app/api/approve-student/route.ts`
- **Behavior**: When teacher approves student → auto-creates chat conversation

### 2. Real-time Chat
- **File**: `src/components/chat/ChatView.tsx`
- **Features**: Direct messages, group chats, real-time updates via Supabase Realtime

### 3. Student Dashboard Navigation
- **Sidebar**: 5 buttons (Home, Profile, Application, Documents, Chat)
- **Sub-navigation**: Floating pill tabs within each page

### 4. Teacher Dashboard
- **Features**: Stats cards, Kanban board, student list, pending approvals
- **Real-time**: Updates via TeacherDataContext

### 5. AI Essay Review
- **Edge Function**: `supabase/functions/ai-review`
- **API**: Uses Google Gemini for essay feedback
- **Frontend**: `EssaysTab.tsx` has "Get AI Feedback" button

---

## Navigation Structure

### Student Dashboard
```
Sidebar:
├── Home          → HomeDashboard.tsx
├── Profile       → ProfilePage.tsx (Identity + Family tabs)
├── Application   → ApplicationPage.tsx (Universities + Academic + Essays tabs)
├── Documents     → DocumentsTabPage.tsx
└── Chat          → ChatView.tsx
```

### Teacher Dashboard
```
Sidebar:
├── Command Center → TeacherHomeDashboard.tsx
├── All Students   → StudentListView.tsx / StudentDetailView.tsx
├── Messages       → ChatView.tsx
└── Automation     → AutomationView.tsx
```

---

## Supabase Configuration

- **Project ID**: `ylwyuogdfwugjexyhtrq`
- **URL**: `https://ylwyuogdfwugjexyhtrq.supabase.co`
- **RLS**: Enabled on all tables
- **Realtime**: Enabled for profiles, messages, conversations

---

## Important Notes for AI

1. **VPN Constraint**: User is in China, so external API calls must go through Supabase Edge Functions (not Next.js server routes)

2. **Component Pattern**: Pages use floating sub-navigation (pill tabs) for sections

3. **Auto-chat**: When student is approved, a direct chat is automatically created

4. **Type Safety**: Use TypeScript interfaces from `src/types/`

5. **Styling**: Tailwind CSS v4 with custom orange theme (#E65100)
