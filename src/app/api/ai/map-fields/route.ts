/**
 * AI Field Mapping API
 * 
 * Uses Google Gemini 2.0 Flash to map DOM form elements to student data.
 * Returns an array of field mappings with selectors and values.
 * 
 * @file src/app/api/ai/map-fields/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { callGeminiWithRetry, GeminiAPIError } from "@/lib/gemini-client";
import { createClient } from "@/utils/supabase/server";

// Prompt for Gemini to map form fields to student data
const FIELD_MAPPING_PROMPT = `You are an expert at filling out university application forms. Given a list of form elements (inputs, selects, textareas) and a student's profile data, determine the best mapping between form fields and student data.

FORM ELEMENTS:
"""
{{FORM_ELEMENTS}}
"""

STUDENT DATA:
"""
{{STUDENT_DATA}}
"""

INSTRUCTIONS:
1. Analyze each form element's id, name, label, placeholder, and type to understand what data it expects.
2. Match form elements to the most appropriate student data field.
3. Only include mappings where you have high confidence (>80%) the data is appropriate.
4. For date fields, format as required (usually YYYY-MM-DD or MM/DD/YYYY).
5. For select elements, try to match the student data to likely option values.
6. Skip fields where no appropriate student data exists.

Return a JSON array of mappings:
[
  { "selector": "#field_id_or_[name='field_name']", "value": "The value to fill", "confidence": 0.95 },
  ...
]

IMPORTANT:
- Use the EXACT selector provided in the form elements
- Only include fields with confidence > 0.8
- Return ONLY the JSON array, no other text`;

export async function POST(request: NextRequest) {
    try {
        // Verify authentication
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Parse request body
        const { html_context, student_data } = await request.json();

        if (!html_context || !student_data) {
            return NextResponse.json(
                { error: "Missing required fields: html_context,student_data" },
                { status: 400 }
            );
        }

        // Get API key
        const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "AI service not configured" },
                { status: 500 }
            );
        }

        // Prepare the prompt
        const prompt = FIELD_MAPPING_PROMPT
            .replace("{{FORM_ELEMENTS}}", html_context)
            .replace("{{STUDENT_DATA}}", JSON.stringify(student_data, null, 2));

        // Call Gemini
        let text: string;
        try {
            text = await callGeminiWithRetry(
                apiKey,
                {
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.1, // Low temperature for consistent, accurate mappings
                        maxOutputTokens: 4096,
                        responseMimeType: "application/json",
                    },
                },
                {
                    maxRetries: 2,
                    timeoutMs: 30000,
                }
            );
            console.log("[Map Fields] Gemini response received");
        } catch (error: any) {
            console.error("[Map Fields] Gemini API error:", error);
            const message = error instanceof GeminiAPIError
                ? error.message
                : "AI service temporarily unavailable. Please try again.";
            return NextResponse.json(
                { error: message },
                { status: error instanceof GeminiAPIError ? error.statusCode : 500 }
            );
        }

        // Parse the JSON response
        let mapping;
        try {
            // Clean up the response if it has markdown code blocks
            let jsonText = text;
            if (text.includes("```json")) {
                jsonText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "");
            } else if (text.includes("```")) {
                jsonText = text.replace(/```\n?/g, "");
            }
            mapping = JSON.parse(jsonText.trim());

            // Validate the response structure
            if (!Array.isArray(mapping)) {
                throw new Error("Response is not an array");
            }

            // Filter to only high-confidence mappings
            mapping = mapping.filter((item: any) =>
                item.selector &&
                item.value !== undefined &&
                item.value !== null &&
                (item.confidence === undefined || item.confidence >= 0.8)
            );

        } catch (parseError) {
            console.error("[Map Fields] JSON parse error:", parseError);
            return NextResponse.json(
                { error: "Failed to parse AI response", mapping: [] },
                { status: 500 }
            );
        }

        console.log(`[Map Fields] Returning ${mapping.length} field mappings`);
        return NextResponse.json({ mapping });

    } catch (error: any) {
        console.error("[Map Fields] Unexpected error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to map fields" },
            { status: 500 }
        );
    }
}
