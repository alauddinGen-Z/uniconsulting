"use client";

import { ArrowLeft, Users, Search, MoreVertical, X, Copy, Trash2, LogOut } from "lucide-react";
import { Conversation } from "./types";
import { useState, useRef, useEffect } from "react";

interface ChatHeaderProps {
    conversation: Conversation;
    userRole: 'teacher' | 'student';
    onBack: () => void;
    onSearch: (query: string) => void;
    isSearching: boolean;
    onToggleSearch: () => void;
    onCopyChat: () => void;
    onClearMessages?: () => void;
    onLeaveGroup?: () => void;
}

export default function ChatHeader({
    conversation,
    userRole,
    onBack,
    onSearch,
    isSearching,
    onToggleSearch,
    onCopyChat,
    onClearMessages,
    onLeaveGroup
}: ChatHeaderProps) {
    const [showMenu, setShowMenu] = useState(false);
    const [localQuery, setLocalQuery] = useState("");
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalQuery(e.target.value);
        onSearch(e.target.value);
    };

    return (
        <div className="h-16 px-4 bg-white border-b border-slate-100 flex items-center justify-between shadow-sm flex-shrink-0">
            <div className="flex items-center gap-3">
                <button
                    onClick={onBack}
                    className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${conversation.type === 'group'
                    ? 'bg-gradient-to-br from-purple-500 to-purple-600'
                    : 'bg-gradient-to-br from-orange-400 to-orange-500'
                    }`}>
                    {conversation.type === 'group'
                        ? <Users className="w-5 h-5" />
                        : conversation.name.charAt(0)}
                </div>
                <div>
                    <h3 className="font-bold text-slate-800">{conversation.name}</h3>
                    <p className="text-xs text-slate-500">
                        {conversation.type === 'group' ? 'Group Chat' : 'Direct Message'}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {/* Search in messages */}
                {isSearching ? (
                    <div className="flex items-center bg-slate-100 rounded-lg px-3 py-1.5">
                        <input
                            type="text"
                            value={localQuery}
                            onChange={handleSearchChange}
                            placeholder="Search messages..."
                            className="bg-transparent text-sm w-32 focus:outline-none"
                            autoFocus
                        />
                        <button onClick={() => { onToggleSearch(); setLocalQuery(""); onSearch(""); }}>
                            <X className="w-4 h-4 text-slate-400" />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => { onToggleSearch(); }}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                        title="Search messages"
                    >
                        <Search className="w-5 h-5" />
                    </button>
                )}

                {/* Menu */}
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                    >
                        <MoreVertical className="w-5 h-5" />
                    </button>

                    {showMenu && (
                        <div className="absolute right-0 top-10 bg-white rounded-xl shadow-lg border border-slate-100 py-1 w-48 z-10">
                            <button
                                onClick={() => { onCopyChat(); setShowMenu(false); }}
                                className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                            >
                                <Copy className="w-4 h-4" /> Copy Chat
                            </button>
                            {userRole === 'teacher' && onClearMessages && (
                                <button
                                    onClick={() => { onClearMessages(); setShowMenu(false); }}
                                    className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" /> Clear Messages
                                </button>
                            )}
                            {conversation.type === 'group' && onLeaveGroup && (
                                <button
                                    onClick={() => { onLeaveGroup(); setShowMenu(false); }}
                                    className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                    <LogOut className="w-4 h-4" /> Leave Group
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
