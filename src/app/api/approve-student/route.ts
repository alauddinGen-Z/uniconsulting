import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    const supabase = await createClient();

    try {
        // 1. Verify Teacher Session
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Verify User is a Teacher
        const { data: teacherProfile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profileError || teacherProfile.role !== 'teacher') {
            return NextResponse.json({ error: "Forbidden: Only teachers can perform this action" }, { status: 403 });
        }

        // 3. Parse Request Body
        const { studentId, action } = await request.json();

        if (!studentId || !['approve', 'reject'].includes(action)) {
            return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
        }

        const newStatus = action === 'approve' ? 'approved' : 'rejected';

        // 4. Update Student Status
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ approval_status: newStatus })
            .eq('id', studentId)
            .eq('role', 'student');

        if (updateError) {
            throw updateError;
        }

        // 5. If approved, auto-create a direct chat between teacher and student
        if (action === 'approve') {
            try {
                // Check if a direct chat already exists between this teacher and student
                const { data: existingParticipations } = await supabase
                    .from('conversation_participants')
                    .select('conversation_id')
                    .eq('user_id', studentId);

                let chatExists = false;
                const studentConvIds = existingParticipations?.map(p => p.conversation_id) || [];

                // Check each conversation to see if it's a direct chat with this teacher
                for (const convId of studentConvIds) {
                    const { data: conv } = await supabase
                        .from('conversations')
                        .select('*')
                        .eq('id', convId)
                        .eq('type', 'direct')
                        .single();

                    if (conv) {
                        const { data: participants } = await supabase
                            .from('conversation_participants')
                            .select('user_id')
                            .eq('conversation_id', convId);

                        const participantIds = participants?.map(p => p.user_id) || [];
                        if (participantIds.includes(user.id)) {
                            chatExists = true;
                            break;
                        }
                    }
                }

                // Create new direct chat if one doesn't exist
                if (!chatExists) {
                    const { data: newConv, error: convError } = await supabase
                        .from('conversations')
                        .insert({
                            type: 'direct',
                            teacher_id: user.id
                        })
                        .select()
                        .single();

                    if (!convError && newConv) {
                        // Add both teacher and student as participants
                        await supabase
                            .from('conversation_participants')
                            .insert([
                                { conversation_id: newConv.id, user_id: user.id },
                                { conversation_id: newConv.id, user_id: studentId }
                            ]);

                        // Send a welcome message from the teacher
                        await supabase
                            .from('messages')
                            .insert({
                                conversation_id: newConv.id,
                                sender_id: user.id,
                                content: "Welcome! Your account has been approved. Feel free to message me if you have any questions.",
                                is_announcement: false
                            });
                    }
                }
            } catch (chatError) {
                // Don't fail the approval if chat creation fails
                console.error("Error creating auto-chat:", chatError);
            }
        }

        return NextResponse.json({ success: true, status: newStatus });

    } catch (error: any) {
        console.error("Error processing approval:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
