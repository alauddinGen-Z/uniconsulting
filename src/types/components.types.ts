/**
 * Component Types - Shared Props & Interfaces
 * 
 * Import from '@/types' for type-safe component props.
 */

// ============================================
// COMMON PROPS
// ============================================

export interface BaseComponentProps {
    className?: string;
}

export interface LockedProps {
    isLocked?: boolean;
}

// ============================================
// STUDENT COMPONENTS
// ============================================

export interface StudentDashboardProps {
    activeTab: string;
    onTabChange: (tabId: string) => void;
}

export interface StudentTabProps extends LockedProps {
    // Common props for student tab components
}

export interface HomeDashboardProps {
    onNavigate: (tab: string) => void;
}

// ============================================
// TEACHER COMPONENTS
// ============================================

export interface TeacherSidebarProps {
    activeTab: string;
    onTabChange: (tabId: string) => void;
}

export interface StudentListItemProps {
    student: {
        id: string;
        full_name: string | null;
        email: string | null;
        approval_status: string;
    };
    onSelect?: (id: string) => void;
}

// ============================================
// CHAT COMPONENTS
// ============================================

export interface ChatViewProps {
    userRole: 'teacher' | 'student';
}

// ============================================
// MODAL COMPONENTS
// ============================================

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export interface ConfirmModalProps extends ModalProps {
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
}
