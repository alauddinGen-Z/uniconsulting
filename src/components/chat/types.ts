export interface Conversation {
    id: string;
    type: 'group' | 'direct';
    name: string;
    avatar?: string;
    last_message?: string;
    last_message_time?: string;
    unread?: number;
    teacher_id: string;
}

export interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    sender_name?: string;
    is_from_me?: boolean;
    isOptimistic?: boolean;
}

export interface Student {
    id: string;
    full_name: string;
    email: string;
}
