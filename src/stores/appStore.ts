"use client";

/**
 * Global App Store (Zustand)
 * 
 * Manages cross-cutting user data that needs to update everywhere instantly:
 * - User profile (name, avatar, role)
 * - Notification count
 * - Current active class/session
 * 
 * @file src/stores/appStore.ts
 */

import { create } from "zustand";

export interface AppUser {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: "student" | "teacher";
}

interface AppState {
    // User data
    user: AppUser | null;
    isAuthenticated: boolean;

    // Notification state
    unreadNotificationCount: number;

    // Current context
    currentClassId: string | null;

    // Actions
    setUser: (user: AppUser | null) => void;
    updateUserProfile: (updates: Partial<AppUser>) => void;
    setUnreadNotificationCount: (count: number) => void;
    incrementNotificationCount: () => void;
    decrementNotificationCount: () => void;
    setCurrentClassId: (classId: string | null) => void;
    clearStore: () => void;
}

export const useAppStore = create<AppState>((set) => ({
    // Initial state
    user: null,
    isAuthenticated: false,
    unreadNotificationCount: 0,
    currentClassId: null,

    // Actions
    setUser: (user) => set({
        user,
        isAuthenticated: user !== null
    }),

    updateUserProfile: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null
    })),

    setUnreadNotificationCount: (count) => set({
        unreadNotificationCount: count
    }),

    incrementNotificationCount: () => set((state) => ({
        unreadNotificationCount: state.unreadNotificationCount + 1
    })),

    decrementNotificationCount: () => set((state) => ({
        unreadNotificationCount: Math.max(0, state.unreadNotificationCount - 1)
    })),

    setCurrentClassId: (classId) => set({
        currentClassId: classId
    }),

    clearStore: () => set({
        user: null,
        isAuthenticated: false,
        unreadNotificationCount: 0,
        currentClassId: null,
    }),
}));
