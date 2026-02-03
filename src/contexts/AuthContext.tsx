"use client";

/**
 * Auth Context
 * 
 * Centralized authentication management that:
 * - Syncs Supabase auth state with Zustand store
 * - Provides loading states for auth operations
 * - Handles session persistence
 * 
 * @file src/contexts/AuthContext.tsx
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAppStore, AppUser } from "@/stores/appStore";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
    session: Session | null;
    user: User | null;
    isLoading: boolean;
    signOut: () => Promise<void>;
    refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const { setUser: setAppUser, clearStore } = useAppStore();
    const supabase = createClient();

    // Sync user profile to Zustand store
    const syncUserToStore = useCallback(async (authUser: User | null) => {
        if (!authUser) {
            setAppUser(null);
            return;
        }

        try {
            const { data: profile, error } = await supabase
                .from("profiles")
                .select("full_name, role, agency_id")
                .eq("id", authUser.id)
                .maybeSingle();

            if (error) {
                console.error("Error fetching profile:", error?.message || error?.code || error);
                return;
            }

            if (profile) {
                const appUser: AppUser = {
                    id: authUser.id,
                    agencyId: profile.agency_id || "",
                    name: profile.full_name || authUser.email?.split("@")[0] || "User",
                    email: authUser.email || "",
                    avatarUrl: null,
                    role: profile.role as any,
                };
                setAppUser(appUser);
            }
        } catch (error) {
            console.error("Error syncing user to store:", error);
        }
    }, [supabase, setAppUser]);

    // Initialize auth state
    useEffect(() => {
        const initAuth = async () => {
            try {
                const { data: { session: initialSession } } = await supabase.auth.getSession();
                setSession(initialSession);
                setUser(initialSession?.user || null);
                await syncUserToStore(initialSession?.user || null);
            } catch (error) {
                console.error("Error initializing auth:", error);
            } finally {
                setIsLoading(false);
            }
        };

        initAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
                setSession(newSession);
                setUser(newSession?.user || null);
                await syncUserToStore(newSession?.user || null);

                if (event === "SIGNED_OUT") {
                    clearStore();
                }
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [supabase, syncUserToStore, clearStore]);

    const signOut = useCallback(async () => {
        try {
            await supabase.auth.signOut();
            clearStore();
        } catch (error) {
            console.error("Error signing out:", error);
            throw error;
        }
    }, [supabase, clearStore]);

    const refreshSession = useCallback(async () => {
        try {
            const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
            setSession(refreshedSession);
            setUser(refreshedSession?.user || null);
            await syncUserToStore(refreshedSession?.user || null);
        } catch (error) {
            console.error("Error refreshing session:", error);
        }
    }, [supabase, syncUserToStore]);

    return (
        <AuthContext.Provider value={{ session, user, isLoading, signOut, refreshSession }}>
            {children}
        </AuthContext.Provider>
    );
}
