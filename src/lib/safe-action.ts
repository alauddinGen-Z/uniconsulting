/**
 * Safe Action Client - next-safe-action configuration
 * 
 * Provides type-safe server actions with Zod validation
 * and automatic authentication/agency context injection.
 */

import { createSafeActionClient } from "next-safe-action";
import { createClient } from "@/utils/supabase/server";

/**
 * Base action client with error handling
 */
export const actionClient = createSafeActionClient({
    handleServerError(e) {
        console.error("Action error:", e.message);
        // Return generic error message to client (don't expose internals)
        if (e.message.includes("Unauthorized")) {
            return "You must be logged in to perform this action";
        }
        if (e.message.includes("No agency")) {
            return "You must be assigned to an agency";
        }
        return "An unexpected error occurred";
    },
});

/**
 * Authenticated action client
 * - Validates user is logged in
 * - Injects user context
 */
export const authActionClient = actionClient.use(async ({ next }) => {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        throw new Error("Unauthorized");
    }

    return next({
        ctx: { user, supabase }
    });
});

/**
 * Agency-scoped action client
 * - Validates user is logged in
 * - Validates user belongs to an agency
 * - Injects user, agency, and role context
 */
export const agencyActionClient = actionClient.use(async ({ next }) => {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        throw new Error("Unauthorized");
    }

    // Get agency_id and role from profile
    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("agency_id, role")
        .eq("id", user.id)
        .single();

    if (profileError || !profile) {
        throw new Error("Profile not found");
    }

    if (!profile.agency_id) {
        throw new Error("No agency assigned");
    }

    return next({
        ctx: {
            user,
            agencyId: profile.agency_id as string,
            role: profile.role as string,
            supabase
        }
    });
});

/**
 * Owner-only action client
 * - All agency context validations
 * - Additionally validates user is agency owner
 */
export const ownerActionClient = agencyActionClient.use(async ({ next, ctx }) => {
    if (ctx.role !== 'owner') {
        throw new Error("This action requires owner privileges");
    }

    return next({ ctx });
});

// Type exports for use in actions
export type ActionContext = {
    user: { id: string; email?: string };
    supabase: Awaited<ReturnType<typeof createClient>>;
};

export type AgencyContext = ActionContext & {
    agencyId: string;
    role: string;
};
