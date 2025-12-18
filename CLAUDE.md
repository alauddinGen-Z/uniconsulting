# UNICONSULTING B2B SAAS PLATFORM - ARCHITECTURAL DIGEST

> **AI Agent Project Memory** - This document serves as the persistent context for all AI coding agents working on UniConsulting.

---

## 1. ROLE AND SCOPE DEFINITION

You are the **Principal Engineer** for UniConsulting, tasked with building a secure, **multi-tenant B2B SaaS platform** using Next.js 15 (App Router), TypeScript, Tailwind v4, and Supabase.

### Primary Constraint
The application MUST strictly enforce **multi-tenancy isolation** using Row Level Security (RLS) based on the `agency_id`. No user must ever be able to read, write, or query data belonging to a different agency.

### Scope Exclusion
You MUST **EXCLUDE** all components related to:
- ❌ Desktop Application (Electron)
- ❌ IPC bridges
- ❌ Python automation services
- ❌ Playwright browser automation
- ❌ PowerSync offline infrastructure

**Focus exclusively on:** Next.js Web Application and Supabase Backend.

---

## 2. EXECUTIVE SUMMARY & BUSINESS GOAL

UniConsulting is an **AI-powered university application management platform** that connects education consulting agencies with students applying to universities abroad.

| System | Purpose | Key Capabilities |
| :--- | :--- | :--- |
| **Web Application** | Multi-tenant B2B SaaS platform | Agency management, student profiles, essay review, Kanban tracking |
| **Backend** | Supabase with strict RLS | PostgreSQL, Auth, Edge Functions, Row Level Security |

### User Roles (Per Agency)
| Role | Description |
| :--- | :--- |
| **Admin** | Agency owner, full control over agency data and users |
| **Teacher** | Manages assigned students, reviews essays, tracks applications |
| **Student** | Fills profile, uploads documents, writes essays, receives AI feedback |

---

## 3. TECHNOLOGY STACK (CORE DEPENDENCIES)

| Layer | Framework/Technology | Version/Constraint | Rationale |
| :--- | :--- | :--- | :--- |
| **Frontend** | Next.js 15 (App Router) | RSCs + Server Actions | Core UI/Business Logic Layer |
| **Backend/DB** | Supabase | PostgreSQL, Auth, RLS, Edge Functions | Multi-tenant security foundation |
| **Type Safety** | TypeScript + Zod | End-to-end validation via `next-safe-action` | Schema-First Directive |
| **Styling** | Tailwind CSS v4 | Custom theming | Modern UI framework |
| **AI Integration** | Google Gemini 1.5 Pro | Supabase Edge Functions only | Essay Review, University Matcher |
| **State** | React Query + Zustand | TanStack Query v5 | Server state caching |

---

## 4. IMMUTABLE ARCHITECTURAL MANDATES

### 4.1. MANDATORY PRE-EXECUTION: Chain-of-Verification (CoVe)

Before outputting any final code, you MUST execute the four-step CoVe self-correction loop with explicit checks for:

| Check | Verification |
| :--- | :--- |
| **Hydration Integrity** | No browser APIs (`window`, `document`, `localStorage`) outside `useEffect` or `"use client"` boundary |
| **Caching Mutability** | Server Action mutations MUST include `revalidatePath` or `revalidateTag` |
| **Input Security** | Generate Zod schema FIRST, then wrap with `next-safe-action` |

### 4.2. SERVER ACTION MANDATE

ALL data mutations, business logic, and authentication checks MUST be implemented using **Next.js 15 Server Actions (SA)**.

```typescript
// REQUIRED PATTERN: Schema-First Directive
import { z } from 'zod';
import { actionClient } from '@/lib/safe-action';

const inputSchema = z.object({
  studentId: z.string().uuid(),
  status: z.enum(['pending', 'approved', 'rejected']),
});

export const updateStudentStatus = actionClient
  .schema(inputSchema)
  .action(async ({ parsedInput }) => {
    // Server Action logic here
    revalidatePath('/teacher/students');
    return { success: true };
  });
```

### 4.3. CRITICAL SECURITY CONTEXT: Supabase Security Context Loop (SSCL)

**RLS policies are the NON-NEGOTIABLE security foundation.**

| Rule | Implementation |
| :--- | :--- |
| **Agency Isolation** | All tables MUST have `agency_id` column with RLS policy |
| **Auth Mapping** | `auth.uid()` → `profiles.agency_id` → data access |
| **Performance Hint** | Always include explicit `.eq('agency_id', agencyId)` filter even with RLS |

### 4.4. CONTEXT PRUNING DIRECTIVE (MCIS)

Aggressively prune irrelevant context. Prioritize:
- ✅ Local component structures
- ✅ TypeScript types
- ✅ Server Action files
- ✅ Supabase schema/RLS policies

Exclude:
- ❌ Electron/Desktop code
- ❌ Python automation
- ❌ Generic documentation

---

## 5. DATABASE SCHEMA (MULTI-TENANT)

### Core Tables

```sql
-- Agencies (Top-level tenant)
CREATE TABLE agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Profiles (Linked to agency)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) NOT NULL,
    agency_id UUID REFERENCES agencies(id) NOT NULL,
    role TEXT NOT NULL, -- 'admin', 'teacher', 'student'
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Students (Agency-scoped)
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) NOT NULL,
    teacher_id UUID REFERENCES profiles(id),
    full_name TEXT NOT NULL,
    application_status TEXT, -- Kanban stage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Essays (Agency-scoped)
CREATE TABLE essays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) NOT NULL,
    student_id UUID REFERENCES students(id) NOT NULL,
    content TEXT,
    ai_feedback JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### RLS Policy Template (CRITICAL)

```sql
-- MANDATORY: Apply to ALL tables with agency_id
CREATE POLICY "RLS_agency_select"
ON {table_name} FOR SELECT
TO authenticated USING (
    agency_id IN (
        SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "RLS_agency_insert"
ON {table_name} FOR INSERT
TO authenticated WITH CHECK (
    agency_id IN (
        SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "RLS_agency_update"
ON {table_name} FOR UPDATE
TO authenticated USING (
    agency_id IN (
        SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "RLS_agency_delete"
ON {table_name} FOR DELETE
TO authenticated USING (
    agency_id IN (
        SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
);
```

---

## 6. DEVELOPMENT PHASES

### Phase 1: Setup and Initial Configuration
- [x] Configure Next.js 15 project structure (App Router, RSC/SCC boundary)
- [ ] Define global TypeScript types for `Agency`, `Profile`, `Student`
- [ ] Setup `next-safe-action` with Zod schemas

### Phase 2: Authentication and Strict RLS Enforcement
- [ ] Implement Server Action for user signup (creates `auth.users` + `profiles` entry)
- [ ] Generate RLS policies for all tables using template above
- [ ] Ensure `auth.uid()` → `agency_id` mapping is correct

### Phase 3: Agency Dashboards
- [ ] **Agency Dashboard** (RSC): Display stats (total students, pending applications)
- [ ] **Kanban Board** (Client Component): DnD with Server Action mutations
- [ ] Initial data fetch in parent RSC, passed to client components

### Phase 4: AI Integration
- [ ] **AI Essay Review** via Supabase Edge Function (`/functions/v1/ai-review`)
- [ ] Type-safe Server Action wrapper for Edge Function invocation
- [ ] Implement caching layer to prevent duplicate AI requests

---

## 7. FILE STRUCTURE

```
uniconsulting/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Auth layout (login, signup)
│   │   ├── agency/            # Agency dashboard pages
│   │   ├── teacher/           # Teacher dashboard pages
│   │   ├── student/           # Student dashboard pages
│   │   └── api/               # API routes (minimal, prefer SA)
│   ├── components/
│   │   ├── agency/            # Agency-specific components
│   │   ├── teacher/           # Teacher-specific components
│   │   ├── student/           # Student-specific components
│   │   ├── kanban/            # Kanban board (DnD)
│   │   └── shared/            # Shared components
│   ├── actions/               # Server Actions (next-safe-action)
│   │   ├── auth.ts           # Auth actions
│   │   ├── students.ts       # Student CRUD
│   │   └── essays.ts         # Essay management
│   ├── lib/
│   │   ├── safe-action.ts    # next-safe-action client
│   │   ├── supabase/         # Supabase clients
│   │   └── ai-cache.ts       # AI query caching
│   └── types/                 # TypeScript types
├── supabase/
│   └── functions/
│       ├── ai-review/        # Essay review Edge Function
│       └── university-matcher/ # AI matching
├── sql/                       # Database migrations
└── public/                    # Static assets
```

---

## 8. CRITICAL PATTERNS

### Pattern 1: RSC → Client Component Data Flow

```tsx
// app/teacher/dashboard/page.tsx (Server Component)
import { createServerClient } from '@/lib/supabase/server';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const { data: user } = await supabase.auth.getUser();
  
  // Fetch with explicit agency filter (Performance Hint)
  const { data: students } = await supabase
    .from('students')
    .select('*')
    .eq('agency_id', user?.user_metadata?.agency_id);
  
  // Pass to Client Component
  return <KanbanBoard initialStudents={students ?? []} />;
}
```

### Pattern 2: Server Action with Cache Invalidation

```typescript
// actions/students.ts
'use server';

import { z } from 'zod';
import { actionClient } from '@/lib/safe-action';
import { revalidatePath } from 'next/cache';

const updateStageSchema = z.object({
  studentId: z.string().uuid(),
  newStage: z.enum(['applied', 'interviewing', 'accepted', 'rejected']),
});

export const updateStudentStage = actionClient
  .schema(updateStageSchema)
  .action(async ({ parsedInput }) => {
    const supabase = await createServerClient();
    
    const { error } = await supabase
      .from('students')
      .update({ application_status: parsedInput.newStage })
      .eq('id', parsedInput.studentId);
    
    if (error) throw new Error(error.message);
    
    // MANDATORY: Cache invalidation
    revalidatePath('/teacher/dashboard');
    
    return { success: true };
  });
```

### Pattern 3: AI Request with Caching

```typescript
// actions/essays.ts
'use server';

import { createServerClient } from '@/lib/supabase/server';

export const getAIEssayReview = actionClient
  .schema(z.object({ essayId: z.string().uuid() }))
  .action(async ({ parsedInput }) => {
    const supabase = await createServerClient();
    
    // Check cache first
    const { data: cached } = await supabase
      .from('essays')
      .select('ai_feedback')
      .eq('id', parsedInput.essayId)
      .single();
    
    if (cached?.ai_feedback) {
      return { feedback: cached.ai_feedback, cached: true };
    }
    
    // Call Edge Function
    const { data, error } = await supabase.functions.invoke('ai-review', {
      body: { essayId: parsedInput.essayId },
    });
    
    // Store in cache
    await supabase
      .from('essays')
      .update({ ai_feedback: data.feedback })
      .eq('id', parsedInput.essayId);
    
    revalidatePath(`/student/essays/${parsedInput.essayId}`);
    
    return { feedback: data.feedback, cached: false };
  });
```

---

## 9. ENVIRONMENT VARIABLES

| Variable | Scope | Purpose |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Admin operations |
| `GEMINI_API_KEY` | Edge Function only | Google Gemini API |

---

## 10. VERIFICATION CHECKLIST (Pre-Commit)

Before any code submission, verify:

- [ ] **RLS Compliance**: All queries include `agency_id` filter
- [ ] **Schema-First**: Zod schema defined before Server Action logic
- [ ] **Cache Invalidation**: Mutations call `revalidatePath`/`revalidateTag`
- [ ] **Hydration Safe**: No browser APIs in RSC
- [ ] **Type Safety**: All inputs/outputs properly typed
- [ ] **No Scope Creep**: No Desktop/Electron/Python code

---

*Generated: December 17, 2025 | Architecture: B2B SaaS Multi-Tenant | Version: 2.0.0*
