"use client";

import { useEffect, useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useSensor, useSensors, PointerSensor, closestCorners } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { UserCheck, GraduationCap, Calendar, Eye, ArrowRight } from "lucide-react";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useTeacherData } from "@/contexts/TeacherDataContext";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

type PipelineStatus = 'onboarding' | 'docs_collected' | 'applied' | 'accepted';

interface StudentCard {
    id: string;
    name: string;
    pipelineStatus: PipelineStatus;
    approvalStatus: string;
    preferredUniversity?: string;
    createdAt?: string;
}

const COLUMNS: { id: PipelineStatus; title: string; color: string; bgColor: string; borderColor: string; iconBg: string }[] = [
    { id: 'onboarding', title: 'Onboarding', color: 'text-slate-700', bgColor: 'bg-slate-50', borderColor: 'border-slate-200', iconBg: 'bg-slate-100' },
    { id: 'docs_collected', title: 'Docs Ready', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', iconBg: 'bg-blue-100' },
    { id: 'applied', title: 'Applied', color: 'text-violet-700', bgColor: 'bg-violet-50', borderColor: 'border-violet-200', iconBg: 'bg-violet-100' },
    { id: 'accepted', title: 'Accepted', color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', iconBg: 'bg-emerald-100' },
];

interface KanbanBoardProps {
    onSelectStudent?: (studentId: string) => void;
}

export default function KanbanBoard({ onSelectStudent }: KanbanBoardProps) {
    const { students, isLoading } = useTeacherData();
    const [items, setItems] = useState<StudentCard[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const supabase = createClient();

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        })
    );

    useEffect(() => {
        const fetchPipelineStatus = async () => {
            const studentIds = students.map(s => s.id);
            if (studentIds.length === 0) {
                setItems([]);
                return;
            }

            const { data: appData } = await supabase
                .from('applications')
                .select('student_id, status')
                .in('student_id', studentIds);

            const mappedItems: StudentCard[] = students
                .filter(s => s.approval_status === 'approved')
                .map(student => {
                    const app = appData?.find(a => a.student_id === student.id);

                    let pipelineStatus: PipelineStatus = 'onboarding';
                    if (app?.status === 'docs_collected' || app?.status === 'Documents Collected') {
                        pipelineStatus = 'docs_collected';
                    } else if (app?.status === 'applied' || app?.status === 'Submitted') {
                        pipelineStatus = 'applied';
                    } else if (app?.status === 'accepted' || app?.status === 'Accepted') {
                        pipelineStatus = 'accepted';
                    } else if (app?.status && ['onboarding', 'docs_collected', 'applied', 'accepted'].includes(app.status)) {
                        pipelineStatus = app.status as PipelineStatus;
                    }

                    return {
                        id: student.id,
                        name: student.full_name || 'Unnamed Student',
                        pipelineStatus,
                        approvalStatus: student.approval_status,
                        preferredUniversity: student.preferred_university,
                        createdAt: student.created_at
                    };
                });

            setItems(mappedItems);
        };

        fetchPipelineStatus();
    }, [students, supabase]);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) {
            setActiveId(null);
            return;
        }

        const draggedId = active.id as string;
        const targetId = over.id as string;
        const targetColumn = COLUMNS.find(c => c.id === targetId);

        if (targetColumn) {
            setItems(prev => prev.map(item =>
                item.id === draggedId ? { ...item, pipelineStatus: targetColumn.id } : item
            ));

            try {
                const { data: existingApp } = await supabase
                    .from('applications')
                    .select('id')
                    .eq('student_id', draggedId)
                    .maybeSingle();

                if (existingApp) {
                    const { error } = await supabase
                        .from('applications')
                        .update({ status: targetColumn.id })
                        .eq('id', existingApp.id);
                    if (error) throw error;
                } else {
                    const { data: { user } } = await supabase.auth.getUser();
                    const { error } = await supabase
                        .from('applications')
                        .insert({
                            student_id: draggedId,
                            teacher_id: user?.id,
                            university_name: 'TBD',
                            status: targetColumn.id
                        });
                    if (error) throw error;
                }

                toast.success(`Moved to ${targetColumn.title}`);
            } catch (error) {
                console.error('Error updating pipeline status:', error);
                toast.error("Failed to update status");
            }
        }

        setActiveId(null);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <LoadingSpinner />
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                    <UserCheck className="w-10 h-10 opacity-40" />
                </div>
                <p className="font-bold text-lg text-slate-500 mb-1">No students in pipeline</p>
                <p className="text-sm text-center max-w-xs">Approve students from "Pending Approvals" to see them here</p>
            </div>
        );
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            {/* Kanban Columns */}
            <div className="grid grid-cols-4 gap-4 h-full">
                {COLUMNS.map(col => (
                    <DroppableColumn
                        key={col.id}
                        column={col}
                        items={items.filter(i => i.pipelineStatus === col.id)}
                        onSelectStudent={onSelectStudent}
                    />
                ))}
            </div>

            <DragOverlay>
                {activeId ? <StudentCardItem student={items.find(i => i.id === activeId)!} isOverlay /> : null}
            </DragOverlay>
        </DndContext>
    );
}

function DroppableColumn({
    column,
    items,
    onSelectStudent
}: {
    column: { id: PipelineStatus, title: string, color: string, bgColor: string, borderColor: string, iconBg: string },
    items: StudentCard[],
    onSelectStudent?: (id: string) => void
}) {
    const { setNodeRef } = useSortable({
        id: column.id,
        data: { type: 'Column', column },
    });

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col rounded-2xl ${column.bgColor} border ${column.borderColor} overflow-hidden`}
        >
            {/* Column Header */}
            <div className="p-4 border-b border-white/50">
                <div className="flex items-center justify-between">
                    <span className={`font-bold text-sm ${column.color}`}>{column.title}</span>
                    <span className={`${column.iconBg} ${column.color} px-2.5 py-1 rounded-full text-xs font-bold`}>
                        {items.length}
                    </span>
                </div>
            </div>

            {/* Cards Container */}
            <div className="flex-1 p-3 space-y-3 overflow-y-auto min-h-[200px]">
                <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                    {items.map((student) => (
                        <StudentCardItem
                            key={student.id}
                            student={student}
                            onSelect={() => onSelectStudent?.(student.id)}
                        />
                    ))}
                </SortableContext>

                {items.length === 0 && (
                    <div className="h-32 flex items-center justify-center rounded-xl border-2 border-dashed border-slate-200/50">
                        <p className="text-slate-400 text-sm">Drop here</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function StudentCardItem({
    student,
    isOverlay,
    onSelect
}: {
    student: StudentCard,
    isOverlay?: boolean,
    onSelect?: () => void
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: student.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const formatDate = (date?: string) => {
        if (!date) return '';
        return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={onSelect}
            className={`
                group bg-white rounded-xl p-4 shadow-sm 
                hover:shadow-md hover:ring-2 hover:ring-orange-200 
                transition-all cursor-pointer
                ${isDragging ? 'opacity-50 scale-95' : 'opacity-100'}
                ${isOverlay ? 'shadow-xl scale-105 ring-2 ring-orange-400' : ''}
            `}
        >
            <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {student.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-800 text-sm truncate">{student.name}</h4>
                    {student.preferredUniversity && (
                        <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                            <GraduationCap className="w-3 h-3 flex-shrink-0" />
                            {student.preferredUniversity}
                        </p>
                    )}
                </div>

                {/* View Button */}
                <button
                    onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
                    className="p-2 rounded-lg bg-slate-50 text-slate-400 hover:bg-orange-50 hover:text-orange-500 transition-colors opacity-0 group-hover:opacity-100"
                >
                    <Eye className="w-4 h-4" />
                </button>
            </div>

            {/* Footer */}
            {student.createdAt && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(student.createdAt)}
                    </span>
                    <span className="text-xs text-orange-500 font-medium opacity-0 group-hover:opacity-100 flex items-center gap-1">
                        View Details <ArrowRight className="w-3 h-3" />
                    </span>
                </div>
            )}
        </div>
    );
}
