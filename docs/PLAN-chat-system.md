# PLAN-chat-system

> **Goal:** implement and verify the Real-time Chat System between Teachers and Students.

## Phase 1: Database Infrastructure 🗄️
The SQL schema is ready but needs to be applied and verified.

- [x] **Apply Migration**: Execute `sql/add_chat_tables.sql` to create tables and RLS policies.
- [ ] **Verify RLS**: confirm:
    - [ ] Students see only their own chats.
    - [ ] Teachers can see/create chats with their assigned students.
    - [ ] Realtime replication is active for `messages`.

## Phase 2: Frontend Integration 💬
Connect the existing `ChatView` component to the live backend.

- [x] **Data Fetching Verification**: Ensure `fetchConversations` returns correct data structure.
- [x] **Realtime Subscription**: Verify `postgres_changes` events are firing for new messages.
- [x] **Send Flow**: Confirm message insertion works and triggers updates.

## Phase 3: UX Optimization (The "SaaS Feel") 🚀
Make the chat feel instant and premium.

- [ ] **Optimistic UI**: Display messages immediately *before* server confirmation.
- [ ] **Typing Indicators**: Implement Supabase Presence to show "User is typing...".
- [ ] **Scroll Management**: Fix "jumpy" scrolling when new messages arrive.
- [x] **Empty States**: Better UI for "No conversations selected".

## Phase 4: Component Refactoring (Clean Code) 🧹
The `WhatsAppChat.tsx` (formerly ChatView) has been refactored.

- [x] Extract `ChatSidebar`.
- [x] Extract `MessageList`.
- [x] Extract `MessageInput` (w/ Voice logic).
- [x] Extract `ChatHeader` & `NewChatModal`.

## Agent Assignments
- **backend-specialist**: Database schema & RLS.
- **frontend-specialist**: `ChatView` logic and UX optimizations.
- **clean-code**: Component refactoring.

## Verification Checklist
1. Send message as Student -> Receive on Teacher view instantly.
2. Send message as Teacher -> Receive on Student view instantly.
3. Refresh page -> History is preserved.
4. Voice input -> Transcribed correctly.
