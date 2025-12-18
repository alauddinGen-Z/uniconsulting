/**
 * send.ts
 * Secure Chat Message Server Action
 * 
 * CoVe Guarantees:
 *   ✅ Bouncer Logic: Participant check before INSERT
 *   ✅ Injection Prevention: conversationId validated against membership
 *   ✅ Type Safety: Zod schema validation
 */

'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { actionClient } from '@/lib/safe-action';
import { z } from 'zod';

// ============================================
// SCHEMA
// ============================================

const SendMessageSchema = z.object({
    conversationId: z.string().uuid('Invalid conversation ID'),
    content: z.string().min(1, 'Message cannot be empty').max(5000, 'Message too long'),
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;

export type SendMessageOutput = {
    success: boolean;
    messageId?: string;
    error?: string;
};

// ============================================
// ACTION: sendChatMessage
// The "Bouncer" - checks participant membership before insert
// ============================================

export const sendChatMessage = actionClient
    .schema(SendMessageSchema)
    .action(async ({ parsedInput }): Promise<SendMessageOutput> => {
        const { conversationId, content } = parsedInput;
        const supabase = await createClient();

        // ============================================
        // STEP 1: Authenticate User
        // ============================================

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return { success: false, error: 'Authentication required' };
        }

        // ============================================
        // STEP 2: THE BOUNCER - Check Participant Membership
        // This is the critical line that prevents injection
        // ============================================

        const { count, error: participantError } = await supabase
            .from('conversation_participants')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conversationId)
            .eq('user_id', user.id);

        if (participantError) {
            console.error('[Chat] Participant check error:', participantError.message);
            return { success: false, error: 'Failed to verify access' };
        }

        // THE BOUNCER DECISION: Block if not a participant
        if (count === 0) {
            console.warn('[Chat] Unauthorized send attempt:', { userId: user.id, conversationId });
            return { success: false, error: 'Unauthorized: Not a participant' };
        }

        // ============================================
        // STEP 3: Insert Message (User is verified participant)
        // ============================================

        const { data: message, error: insertError } = await supabase
            .from('messages')
            .insert({
                conversation_id: conversationId,
                sender_id: user.id,
                content: content.trim(),
                is_announcement: false,
                is_read: false,
            })
            .select('id')
            .single();

        if (insertError) {
            console.error('[Chat] Insert error:', insertError.message);
            return { success: false, error: 'Failed to send message' };
        }

        // ============================================
        // STEP 4: Update Conversation Timestamp
        // ============================================

        await supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);

        // ============================================
        // STEP 5: Cache Invalidation
        // ============================================

        revalidatePath('/student');
        revalidatePath('/teacher');

        return {
            success: true,
            messageId: message.id,
        };
    });

// ============================================
// ACTION: markMessagesAsRead
// ============================================

const MarkReadSchema = z.object({
    conversationId: z.string().uuid(),
});

export const markMessagesAsRead = actionClient
    .schema(MarkReadSchema)
    .action(async ({ parsedInput }) => {
        const { conversationId } = parsedInput;
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return { success: false, error: 'Authentication required' };
        }

        // Verify participant
        const { count } = await supabase
            .from('conversation_participants')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conversationId)
            .eq('user_id', user.id);

        if (count === 0) {
            return { success: false, error: 'Unauthorized' };
        }

        // Mark messages as read (except own messages)
        const { error: updateError } = await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('conversation_id', conversationId)
            .neq('sender_id', user.id)
            .eq('is_read', false);

        if (updateError) {
            return { success: false, error: 'Failed to mark as read' };
        }

        return { success: true };
    });

// ============================================
// ACTION: createConversation (Teacher/Admin only)
// ============================================

const CreateConversationSchema = z.object({
    participantIds: z.array(z.string().uuid()).min(1, 'At least one participant required'),
    type: z.enum(['direct', 'group']).default('direct'),
    name: z.string().optional(),
});

export const createConversation = actionClient
    .schema(CreateConversationSchema)
    .action(async ({ parsedInput }) => {
        const { participantIds, type, name } = parsedInput;
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return { success: false, error: 'Authentication required' };
        }

        // Verify caller is teacher or admin
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, is_admin')
            .eq('id', user.id)
            .single();

        if (!profile || (profile.role !== 'teacher' && profile.role !== 'owner' && !profile.is_admin)) {
            return { success: false, error: 'Only teachers can create conversations' };
        }

        // Create conversation
        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .insert({
                type,
                name: name || null,
                teacher_id: user.id,
            })
            .select('id')
            .single();

        if (convError) {
            return { success: false, error: 'Failed to create conversation' };
        }

        // Add all participants (including the creator)
        const allParticipants = [...new Set([user.id, ...participantIds])];

        const { error: partError } = await supabase
            .from('conversation_participants')
            .insert(
                allParticipants.map(userId => ({
                    conversation_id: conversation.id,
                    user_id: userId,
                }))
            );

        if (partError) {
            // Rollback: delete the conversation
            await supabase.from('conversations').delete().eq('id', conversation.id);
            return { success: false, error: 'Failed to add participants' };
        }

        revalidatePath('/teacher');
        revalidatePath('/student');

        return {
            success: true,
            conversationId: conversation.id,
        };
    });
