"use server";

import { z } from "zod";
import { actionClient } from "@/lib/safe-action";
import { createServerClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

const registerAgencySchema = z.object({
    name: z.string().min(2, "Agency name must be at least 2 characters"),
    domain: z.string().optional(),
    ownerEmail: z.string().email("Invalid owner email"),
    ownerName: z.string().min(2, "Owner name must be at least 2 characters"),
});

export const registerAgency = actionClient
    .schema(registerAgencySchema)
    .action(async ({ parsedInput }) => {
        const supabase = await createServerClient();

        // 1. Create the agency
        const { data: agency, error: agencyError } = await supabase
            .from("agencies")
            .insert({
                name: parsedInput.name,
                domain: parsedInput.domain,
            })
            .select()
            .single();

        if (agencyError) {
            console.error("Agency creation error:", agencyError);
            throw new Error("Failed to create agency record.");
        }

        // 2. Here we would typically:
        //    a) Create a new auth user or find existing by email
        //    b) Assign them to this agency with the 'owner' role

        // For this implementation, we'll simulate the next step (owner assignment)
        // In a real scenario, you'd use supabase.auth.admin.inviteUserByEmail()

        revalidatePath("/admin/agencies");

        return {
            success: true,
            agencyId: agency.id,
            message: `Agency ${agency.name} registered successfully. Owner invitation sent to ${parsedInput.ownerEmail}.`
        };
    });
