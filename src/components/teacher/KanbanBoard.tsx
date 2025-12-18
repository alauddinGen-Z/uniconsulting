/**
 * KanbanBoard.tsx
 * Drag-and-Drop Kanban for University Application Status Management
 * 
 * CoVe Guarantees:
 *   ✅ No Flicker: Optimistic updates persist until rollback
 *   ✅ Race Safe: isPending disables concurrent drags
 *   ✅ Visual Feedback: DragOverlay prevents ghosting
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragStartEvent,
    type DragEndEvent,
    type DragOverEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import { updateStudentStatus } from '@/app/teacher/actions/kanban';

// ============================================
// TYPES
// ============================================

export type ApplicationStatus =
    | 'researching'
    | 'preparing'
    | 'submitted'
    | 'accepted'
    | 'rejected';

export interface KanbanStudent {
    id: string;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    email?: string;
    application_status: ApplicationStatus;
    university_name?: string;
}

interface KanbanBoardProps {
    initialStudents: KanbanStudent[];
    onRefresh?: () => void;
}

// ============================================
// COLUMN CONFIGURATION
// ============================================

const COLUMNS: { id: ApplicationStatus; title: string; color: string }[] = [
    { id: 'researching', title: 'Researching', color: 'bg-slate-500' },
    { id: 'preparing', title: 'Preparing', color: 'bg-blue-500' },
    { id: 'submitted', title: 'Submitted', color: 'bg-amber-500' },
    { id: 'accepted', title: 'Accepted', color: 'bg-green-500' },
    { id: 'rejected', title: 'Rejected', color: 'bg-red-500' },
];

// ============================================
// MAIN COMPONENT
// ============================================

export function KanbanBoard({ initialStudents, onRefresh }: KanbanBoardProps) {
    // State
    const [students, setStudents] = useState<KanbanStudent[]>(initialStudents);
    const [activeStudent, setActiveStudent] = useState<KanbanStudent | null>(null);
    const [isPending, setIsPending] = useState(false);

    // Sensors for drag detection
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(KeyboardSensor)
    );

    // Group students by status
    const studentsByStatus = useMemo(() => {
        const grouped: Record<ApplicationStatus, KanbanStudent[]> = {
            researching: [],
            preparing: [],
            submitted: [],
            accepted: [],
            rejected: [],
        };

        students.forEach((student) => {
            const status = student.application_status || 'researching';
            if (grouped[status]) {
                grouped[status].push(student);
            }
        });

        return grouped;
    }, [students]);

    // ============================================
    // DRAG HANDLERS
    // ============================================

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const { active } = event;
        const student = students.find((s) => s.id === active.id);
        setActiveStudent(student || null);
    }, [students]);

    const handleDragOver = useCallback((event: DragOverEvent) => {
        // Optional: Handle drag over for visual feedback
    }, []);

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveStudent(null);

        if (!over || isPending) return;

        const studentId = active.id as string;
        const newStatus = over.id as ApplicationStatus;

        // Find the student
        const student = students.find((s) => s.id === studentId);
        if (!student || student.application_status === newStatus) return;

        // ============================================
        // OPTIMISTIC UPDATE (No Flicker)
        // ============================================

        // 1. Create snapshot for rollback
        const snapshot = [...students];

        // 2. Update local state immediately
        setStudents((prev) =>
            prev.map((s) =>
                s.id === studentId
                    ? { ...s, application_status: newStatus }
                    : s
            )
        );

        // 3. Show optimistic feedback
        toast.loading('Updating status...', { id: 'kanban-update' });

        // ============================================
        // SERVER ACTION (With Rollback)
        // ============================================

        setIsPending(true);

        try {
            const result = await updateStudentStatus({
                studentId,
                newStatus,
            });

            if (!result?.data?.success) {
                throw new Error(result?.data?.error || 'Failed to update');
            }

            toast.success('Status updated', { id: 'kanban-update' });
            onRefresh?.();
        } catch (error) {
            // ROLLBACK on error
            setStudents(snapshot);
            toast.error(
                error instanceof Error ? error.message : 'Failed to update status',
                { id: 'kanban-update' }
            );
        } finally {
            setIsPending(false);
        }
    }, [students, isPending, onRefresh]);

    // ============================================
    // RENDER
    // ============================================

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex gap-4 overflow-x-auto pb-4">
                {COLUMNS.map((column) => (
                    <KanbanColumn
                        key={column.id}
                        id={column.id}
                        title={column.title}
                        color={column.color}
                        students={studentsByStatus[column.id]}
                        disabled={isPending}
                    />
                ))}
            </div>

            {/* Drag Overlay - Prevents ghosting glitch */}
            <DragOverlay>
                {activeStudent ? (
                    <StudentCard student={activeStudent} isDragging />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

// ============================================
// COLUMN COMPONENT
// ============================================

interface KanbanColumnProps {
    id: ApplicationStatus;
    title: string;
    color: string;
    students: KanbanStudent[];
    disabled?: boolean;
}

function KanbanColumn({ id, title, color, students, disabled }: KanbanColumnProps) {
    const { setNodeRef } = useSortable({ id, disabled });

    return (
        <div
            ref={setNodeRef}
            className="flex-shrink-0 w-72 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3"
        >
            {/* Column Header */}
            <div className="flex items-center gap-2 mb-3 px-1">
                <div className={`w-3 h-3 rounded-full ${color}`} />
                <h3 className="font-semibold text-gray-700 dark:text-gray-200">
                    {title}
                </h3>
                <span className="ml-auto text-sm text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                    {students.length}
                </span>
            </div>

            {/* Cards */}
            <SortableContext
                id={id}
                items={students.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="space-y-2 min-h-[200px]">
                    {students.map((student) => (
                        <SortableCard key={student.id} student={student} disabled={disabled} />
                    ))}
                </div>
            </SortableContext>
        </div>
    );
}

// ============================================
// SORTABLE CARD (Wrapper)
// ============================================

interface SortableCardProps {
    student: KanbanStudent;
    disabled?: boolean;
}

function SortableCard({ student, disabled }: SortableCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: student.id, disabled });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <StudentCard student={student} isDragging={isDragging} />
        </div>
    );
}

// ============================================
// STUDENT CARD
// ============================================

interface StudentCardProps {
    student: KanbanStudent;
    isDragging?: boolean;
}

function StudentCard({ student, isDragging }: StudentCardProps) {
    const name = student.full_name ||
        `${student.first_name || ''} ${student.last_name || ''}`.trim() ||
        'Unknown Student';

    return (
        <div
            className={`
        bg-white dark:bg-gray-700 rounded-lg p-3 cursor-grab
        border border-gray-200 dark:border-gray-600
        transition-all duration-200
        ${isDragging
                    ? 'shadow-xl scale-105 rotate-2 border-blue-400 dark:border-blue-500'
                    : 'shadow-sm hover:shadow-md'
                }
      `}
        >
            <p className="font-medium text-gray-800 dark:text-gray-100 truncate">
                {name}
            </p>
            {student.email && (
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                    {student.email}
                </p>
            )}
            {student.university_name && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 truncate">
                    🎓 {student.university_name}
                </p>
            )}
        </div>
    );
}

export default KanbanBoard;
