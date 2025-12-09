# 🎯 UniConsulting Demo Preparation Guide

## Pre-Meeting Checklist

### ✅ Technical Setup (Do 30 min before meeting)

1. **Run the SQL Migration** (if not done already):
   Go to Supabase Dashboard → SQL Editor → Run:
   ```sql
   ALTER TABLE profiles 
   ADD COLUMN IF NOT EXISTS ielts_overall TEXT,
   ADD COLUMN IF NOT EXISTS ielts_listening TEXT,
   ADD COLUMN IF NOT EXISTS ielts_reading TEXT,
   ADD COLUMN IF NOT EXISTS ielts_writing TEXT,
   ADD COLUMN IF NOT EXISTS ielts_speaking TEXT,
   ADD COLUMN IF NOT EXISTS sat_total TEXT,
   ADD COLUMN IF NOT EXISTS sat_math TEXT,
   ADD COLUMN IF NOT EXISTS sat_reading TEXT,
   ADD COLUMN IF NOT EXISTS gpa TEXT,
   ADD COLUMN IF NOT EXISTS gpa_scale TEXT,
   ADD COLUMN IF NOT EXISTS gpa_9th TEXT,
   ADD COLUMN IF NOT EXISTS gpa_10th TEXT,
   ADD COLUMN IF NOT EXISTS gpa_11th TEXT,
   ADD COLUMN IF NOT EXISTS gpa_12th TEXT,
   ADD COLUMN IF NOT EXISTS school_system TEXT,
   ADD COLUMN IF NOT EXISTS toefl_total TEXT,
   ADD COLUMN IF NOT EXISTS nationality TEXT,
   ADD COLUMN IF NOT EXISTS passport_number TEXT,
   ADD COLUMN IF NOT EXISTS passport_expiry DATE,
   ADD COLUMN IF NOT EXISTS gender TEXT,
   ADD COLUMN IF NOT EXISTS city_of_birth TEXT,
   ADD COLUMN IF NOT EXISTS city TEXT,
   ADD COLUMN IF NOT EXISTS country TEXT;
   ```

2. **Clear Test Data** (optional - for clean demo):
   ```sql
   -- Delete demo documents
   DELETE FROM documents WHERE student_id IN (
       SELECT id FROM profiles WHERE email LIKE '%demo%'
   );
   ```

3. **Verify Edge Functions are deployed**:
   - document-ocr ✓
   - ai-review ✓
   - university-matcher ✓

---

## Demo Accounts Setup

### Create Fresh Demo Student
- Email: demo.student@test.com
- Password: Demo123!
- Status: Approved (for full access)

### Create Fresh Demo Teacher
- Email: demo.teacher@test.com
- Password: Demo123!
- Role: Teacher

---

## Demo Flow Script (15-20 min)

### 1. Landing Page (1 min)
- Show beautiful landing page design
- Highlight modern UI/UX

### 2. Student Registration Flow (2 min)
- Show signup process
- Explain approval workflow

### 3. Teacher Dashboard (3 min)
- Show Kanban board for student management
- Show pending approvals
- Approve a student live

### 4. Student Dashboard (5 min)
Show tabs:
- **Home**: Dashboard overview with stats
- **Profile**: Identity info form
- **Documents**: DocFu is feature
  - Upload passport → AI extracts name, passport#, dates
  - Upload IELTS → AI extracts scores
- **Application**: University list management
- **Messages**: Real-time chat with teacher

### 5. AI Features (5 min)
- **Document OCR**: Upload passport/IELTS, show auto-extraction
- **AI Essay Review**: Submit essay, get AI feedback
- **AI University Matcher**: Generate university recommendations

### 6. Real-time Features (2 min)
- Show instant tab switching (no loading)
- Show real-time chat
- Show real-time notifications

---

## Key Selling Points to Highlight

1. **AI-Powered Document Processing**
   - Passport OCR → Auto-fills student info
   - Academic documents → Auto-extracts scores
   - Saves hours of manual data entry

2. **AI Essay Review**
   - Instant feedback using Google Gemini
   - Grammar, structure, content analysis

3. **AI University Matcher**
   - Analyzes student profile
   - Recommends matching universities
   - Shows acceptance probability

4. **Modern Architecture**
   - Next.js 16 + React 18
   - Supabase (PostgreSQL + Auth + Real-time)
   - Edge Functions for AI processing
   - Fully responsive design

5. **Real-time Everything**
   - Instant updates
   - No page refreshes needed
   - Fast tab switching

---

## Potential Issues & Fallbacks

| Issue | Fallback |
|-------|----------|
| OCR fails | "AI services sometimes need retry, let me show the extracted data format" |
| Slow loading | "This is due to network - production would have CDN" |
| Edge function error | "Let me refresh and try again" |

---

## Files to Have Ready

1. Sample passport image (for OCR demo)
2. Sample IELTS score report (for OCR demo)
3. Sample essay text (for AI review demo)

---

## Post-Demo Talking Points

- Fully customizable
- Can add more document types
- Can integrate more AI features
- Scalable architecture
- Mobile-responsive

---

Good luck with your demo! 🚀
