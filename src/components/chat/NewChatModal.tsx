"use client";

import { X, Check, UserPlus } from "lucide-react";
import { Student } from "./types";

interface NewChatModalProps {
    students: Student[];
    selectedStudents: string[];
    groupName: string;
    isCreatingGroup: boolean;
    onClose: () => void;
    onToggleStudent: (id: string) => void;
    onGroupNameChange: (name: string) => void;
    onCreateGroup: () => void;
    onCreateDirectChat: (studentId: string) => void;
    onStartSelection: (studentId: string) => void;
}

export default function NewChatModal({
    students,
    selectedStudents,
    groupName,
    isCreatingGroup,
    onClose,
    onToggleStudent,
    onGroupNameChange,
    onCreateGroup,
    onCreateDirectChat,
    onStartSelection
}: NewChatModalProps) {
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden shadow-2xl flex flex-col">
                <div className="h-14 px-4 bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-between flex-shrink-0">
                    <h3 className="text-lg font-bold text-white">
                        {selectedStudents.length > 0 ? 'Create Group' : 'New Chat'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-white/20 text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 flex-1 overflow-hidden flex flex-col">
                    {selectedStudents.length > 0 && (
                        <div className="mb-4">
                            <input
                                type="text"
                                value={groupName}
                                onChange={(e) => onGroupNameChange(e.target.value)}
                                placeholder="Group name..."
                                className="w-full bg-slate-50 rounded-xl px-4 py-2.5 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 border border-slate-200"
                            />
                            <div className="flex flex-wrap gap-2 mt-3">
                                {selectedStudents.map(sid => {
                                    const s = students.find(st => st.id === sid);
                                    return (
                                        <span key={sid} className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                                            {s?.full_name}
                                            <button onClick={() => onToggleStudent(sid)}>
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="overflow-y-auto flex-1">
                        {students.map(student => (
                            <button
                                key={student.id}
                                onClick={() => {
                                    if (selectedStudents.length > 0) {
                                        onToggleStudent(student.id);
                                    } else {
                                        // If no selection initiated, create direct chat immediately
                                        // OR start selection if we want to support long press? 
                                        // For now, let's just assume click means "start direct chat" unless in "group mode"?
                                        // Actually the original logic was:
                                        // if (selectedStudents.length > 0) -> toggle
                                        // else -> createDirectChat
                                        // But we also need a way to START "group selection mode".

                                        // The original code had a separate trigger for group mode or it inferred?
                                        // In original code:
                                        // If clicking a student -> createDirectChat
                                        // Unless... wait, how did they trigger group creation?
                                        // Ah, they could select students? 
                                        // In the original code (lines 830+), checking selectedStudents.length > 0.
                                        // But how does it become > 0?
                                        // Ah, the user probably needs a way to "Select" explicitly if they want to start a group?
                                        // Or maybe the first click is always direct chat?
                                        // Wait, the original code had:
                                        // {selectedStudents.length === 0 && students.length > 0 && (
                                        //    <button ... onClick={() => setSelectedStudents([students[0]?.id])} ... > UsePlus ... Create Group Chat </button>
                                        // )}
                                        // So, there was a specific button to ENTER group mode.
                                        onCreateDirectChat(student.id);
                                    }
                                }}
                                className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-orange-50 transition-colors ${selectedStudents.includes(student.id) ? 'bg-orange-50' : ''
                                    }`}
                            >
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white font-bold">
                                    {student.full_name?.charAt(0) || '?'}
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-semibold text-slate-800">{student.full_name}</p>
                                    <p className="text-sm text-slate-500">{student.email}</p>
                                </div>
                                {selectedStudents.includes(student.id) && (
                                    <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
                                        <Check className="w-4 h-4 text-white" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>

                    {selectedStudents.length > 0 && (
                        <div className="pt-4 border-t border-slate-100">
                            <button
                                onClick={onCreateGroup}
                                disabled={isCreatingGroup || !groupName.trim()}
                                className="w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-200"
                            >
                                {isCreatingGroup ? 'Creating...' : `Create Group (${selectedStudents.length} members)`}
                            </button>
                        </div>
                    )}

                    {selectedStudents.length === 0 && students.length > 0 && (
                        <div className="pt-4 border-t border-slate-100">
                            <button
                                onClick={() => onStartSelection(students[0]?.id)}
                                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-orange-600 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                <UserPlus className="w-5 h-5" />
                                Create Group Chat
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
