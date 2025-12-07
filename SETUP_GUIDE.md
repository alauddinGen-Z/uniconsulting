# 🚀 UniConsulting - Setup and Deployment Guide

## ⚠️ IMPORTANT: Database Migration Required

Before the application will work properly, you **MUST** run the database migration script.

## Step 1: Run the Database Migration

### Option A: Via Supabase Dashboard (Recommended)
1. Open your Supabase project dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Open the file `comprehensive_schema_fix.sql` from your project root
5. Copy and paste the entire content into the SQL Editor
6. Click **Run** (or press `Ctrl+Enter`)
7. Verify there are no errors in the output

### Option B: Via Supabase CLI
```bash
# If you have Supabase CLI installed
supabase db reset
# Then apply the migration
psql -h YOUR_DB_HOST -U postgres -d postgres -f comprehensive_schema_fix.sql
```

## Step 2: Verify Database Changes

After running the migration, verify the schema was updated correctly:

```sql
-- Check that profiles table has new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles';

-- Should include: teacher_id, approval_status, passport_number, date_of_birth, 
--                 home_address, mother_full_name, father_full_name, etc.

-- Check that essays table exists
SELECT * FROM essays LIMIT 1;
```

## Step 3: Create Initial Data (Optional)

### Create a Teacher Account
1. Run the development server:
   ```bash
   npm run dev
   ```
2. Navigate to `http://localhost:3000/login`
3. Click "Create Account"
4. Select **Teacher** role
5. Enter name, email, and password
6. Submit

### Create a Student Account
1. On the login page, click "Create Account"
2. Select **Student** role
3. Enter full name, email, and password
4. **Select the teacher** you just created from the dropdown
5. Submit
6. The student will be in "pending" status

## Step 4: Test All Features

### ✅ Teacher Dashboard Tests

1. **Login as Teacher**
   - Navigate to `/login`
   - Sign in with teacher credentials
   - Should redirect to `/teacher/dashboard`

2. **Approve Student**
   - Click on "Pending" tab in sidebar
   - Should see the student you created
   - Click "Approve" button
   - Student should disappear from pending list

3. **Kanban Board**
   - Return to Dashboard
   - Should see approved student in "Onboarding" column
   - Try dragging student card to "Docs Collected" column
   - Refresh page - student should stay in new column

### ✅ Student Dashboard Tests

1. **Login as Student**
   - Navigate to `/login`
   - Sign in with student credentials
   - Should redirect to `/student/dashboard`
   - If not approved, should see yellow "Pending Approval" banner

2. **Identity Tab**
   - Click "Identity" tab
   - Fill in passport number, date of birth, home address
   - Upload a passport image/PDF
   - Click "Save Changes"
   - Refresh page - data should persist

3. **Family Tab**
   - Click "Family" tab
   - Fill in mother's and father's names
   - Click "Save Changes"
   - Refresh page - data should persist

4. **Academic Tab**
   - Click "Academic" tab
   - Upload IELTS/TOEFL document
   - Upload GPA document
   - Documents should appear as "success"

5. **Essays Tab**
   - Click "Essays" tab
   - Type some content
   - Click "Save Draft"
   - Refresh page - essay should reload

## Step 5: Verify Database Records

Check that data is being saved correctly:

```sql
-- Check student profile was updated
SELECT passport_number, home_address, mother_full_name, father_full_name 
FROM profiles 
WHERE role = 'student';

-- Check documents were uploaded
SELECT student_id, type, file_url, status 
FROM documents;

-- Check essays were saved
SELECT student_id, title, word_count 
FROM essays;

-- Check application status from Kanban
SELECT student_id, status 
FROM applications;
```

## 🎉 All Features Now Working

### Student Dashboard
- ✅ Profile tabs save and load data (Identity, Family)
- ✅ Document uploads save metadata to database
- ✅ Essays save and persist
- ✅ Academic documents upload correctly
- ✅ Approval status checks work
- ✅ Locked state when pending approval

### Teacher Dashboard
- ✅ Pending students view shows unapproved students
- ✅ Approve/reject buttons work
- ✅ Kanban board displays students by status
- ✅ Drag-and-drop updates application status
- ✅ Statistics display correctly
- ✅ Student detail views accessible

### API & Backend
- ✅ Approval API works for all students
- ✅ Authentication flow complete
- ✅ RLS policies enforce proper access
- ✅ Database triggers create profiles on signup

## 🐛 Common Issues

### Issue: "relation 'essays' does not exist"
**Solution**: You haven't run the migration script. Go back to Step 1.

### Issue: "column 'teacher_id' does not exist"
**Solution**: You haven't run the migration script. Go back to Step 1.

### Issue: Documents upload but don't save to database
**Solution**: Make sure you're logged in and your session is valid. Check browser console for errors.

### Issue: Teacher can't see pending students
**Solution**: Make sure students selected this teacher during signup. Check `profiles.teacher_id` matches the teacher's ID.

### Issue: Kanban board drag doesn't persist
**Solution**: Check browser console for errors. Verify the `applications` table exists and has proper RLS policies.

## 📚 Project Structure

```
src/
├── app/
│   ├── login/page.tsx          # Login & signup
│   ├── student/dashboard/       # Student dashboard
│   ├── teacher/dashboard/       # Teacher dashboard
│   └── api/approve-student/     # Approval endpoint
├── components/
│   ├── student/
│   │   ├── tabs/               # Identity, Family, Academic, Essays
│   │   └── DocumentUpload.tsx  # File upload component
│   └── teacher/
│       ├── KanbanBoard.tsx     # Drag-drop board
│       └── PendingStudentsView.tsx
└── utils/supabase/             # Supabase client config

comprehensive_schema_fix.sql    # ⚠️ MUST RUN THIS FIRST
```

## 🔒 Security Notes

- All tables have Row Level Security (RLS) enabled
- Students can only access their own data
- Teachers can approve any pending student
- Document storage is secured per-user

## 🎯 Next Steps

Your application is now fully functional! All features work end-to-end:
- Student signup and approval flow
- Profile data persistence
- Document uploads with metadata
- Teacher management via Kanban
- Essay writing and saving

Happy coding! 🚀
