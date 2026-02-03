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
        console.log("AuthProvider: syncUserToStore triggered for user:", authUser?.id);
        if (!authUser) {
            setAppUser(null);
            return;
        }

        try {
            console.log("AuthProvider: Fetching profile from 'profiles' table...");

            // Add a timeout to the profile fetch to prevent infinite hanging
            const fetchPromise = supabase
                .from("profiles")
                .select("full_name, role, agency_id")
                .eq("id", authUser.id)
                .maybeSingle();

            const timeoutPromise = new Promise<any>((_, reject) =>
                setTimeout(() => reject(new Error("Profile fetch timeout")), 3000)
            );

            let profileData: { data: any | null; error: any | null } = { data: null, error: null };

            try {
                const result = await Promise.race([
                    fetchPromise,
                    timeoutPromise
                ]);
                profileData = result as { data: any | null; error: any | null };
            } catch (err: any) {
                profileData.error = err; // Catch timeout or other promise rejections
            }

            console.log("AuthProvider: Profile fetch result - error:", profileData.error?.message);

            if (profileData.error) {
                console.error("AuthProvider: Profile fetch error:", profileData.error.message);
                // Fallback to basic user info if profile fetch fails or times out
                const appUser: AppUser = {
                    id: authUser.id,
                    agencyId: "", // Default empty
                    name: authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "User",
                    email: authUser.email || "",
                    avatarUrl: null,
                    role: authUser.user_metadata?.role || "student", // Default role
                };
                setAppUser(appUser);
            } else if (profileData.data) {
                console.log("AuthProvider: Profile found - syncing to Zustand store", profileData.data.role);
                const appUser: AppUser = {
                    id: authUser.id,
                    agencyId: profileData.data.agency_id || "",
                    name: profileData.data.full_name || authUser.email?.split("@")[0] || "User",
                    email: authUser.email || "",
                    avatarUrl: null,
                    role: profileData.data.role as any,
                };
                setAppUser(appUser);
            } else {
                console.warn("AuthProvider: No profile found in DB for user, using metadata fallback");
                const appUser: AppUser = {
                    id: authUser.id,
                    agencyId: "", // Default empty
                    name: authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "User",
                    email: authUser.email || "",
                    avatarUrl: null,
                    role: authUser.user_metadata?.role || "student", // Default role
                };
                setAppUser(appUser);
            }
        } catch (err) {
            console.error("AuthProvider: Error syncing user to store (outer catch):", err);
            // Ensure a basic user is set even if the entire sync process fails unexpectedly
            const appUser: AppUser = {
                id: authUser.id,
                agencyId: "",
                name: authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "User",
                email: authUser.email || "",
                avatarUrl: null,
                role: authUser.user_metadata?.role || "student",
            };
            setAppUser(appUser);
        }
    }, [supabase, setAppUser]);

    // Initialize auth state
    useEffect(() => {
        const initAuth = async () => {
            console.log("AuthProvider: initAuth starting...");
            try {
                const { data: { session: initialSession } } = await supabase.auth.getSession();
                console.log("AuthProvider: getSession result - hasSession:", !!initialSession);
                setSession(initialSession);
                setUser(initialSession?.user || null);
                await syncUserToStore(initialSession?.user || null);
            } catch (error) {
                console.error("Error initializing auth:", error);
            } finally {
                console.log("AuthProvider: initAuth finished - setting isLoading to false");
                setIsLoading(false);
            }
        };

        initAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
                console.log("AuthProvider: onAuthStateChange Event:", event);
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
