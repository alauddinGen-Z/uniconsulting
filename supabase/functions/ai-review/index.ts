/**
 * ai-review/index.ts
 * Secure AI Essay Review Edge Function
 * 
 * CoVe Guarantees:
 *   ✅ Cost Defense: GenAI initialized ONLY after auth passes
 *   ✅ Import Safety: Using esm.sh, no npm: specifiers
 *   ✅ Data Leakage: Essay content NEVER logged
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.0";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

// ============================================
// TYPES
// ============================================

interface ReviewRequest {
    content: string;
    essayType?: string;
    wordLimit?: number;
}

interface ReviewResponse {
    score: number;
    critique: string[];
    improvements: string[];
}

interface ErrorResponse {
    error: string;
    code?: string;
}

// ============================================
// CORS HEADERS
// ============================================

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req: Request): Promise<Response> => {
    // ============================================
    // CORS: Handle preflight immediately
    // ============================================

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    // Only allow POST
    if (req.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
    }

    try {
        // ============================================
        // SECURITY LAYER 1: Extract Authorization
        // ============================================

        const authHeader = req.headers.get("Authorization");

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            console.warn("[AI-Review] Missing or invalid Authorization header");
            return jsonResponse({ error: "Unauthorized", code: "NO_TOKEN" }, 401);
        }

        const token = authHeader.replace("Bearer ", "");

        // ============================================
        // SECURITY LAYER 2: Validate User with Supabase
        // CRITICAL: This happens BEFORE GenAI initialization
        // ============================================

        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

        if (!supabaseUrl || !supabaseAnonKey) {
            console.error("[AI-Review] Missing Supabase configuration");
            return jsonResponse({ error: "Server configuration error" }, 500);
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: { Authorization: `Bearer ${token}` },
            },
        });

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        // THE WALLET PROTECTOR: Block before AI initialization
        if (authError || !user) {
            console.warn("[AI-Review] Auth failed:", authError?.message || "No user");
            return jsonResponse({ error: "Unauthorized", code: "INVALID_TOKEN" }, 401);
        }

        console.log("[AI-Review] Authenticated user:", user.id);

        // ============================================
        // PARSE REQUEST BODY
        // ============================================

        let requestBody: ReviewRequest;

        try {
            requestBody = await req.json();
        } catch {
            return jsonResponse({ error: "Invalid JSON body" }, 400);
        }

        const { content, essayType = "Personal Statement", wordLimit = 650 } = requestBody;

        // Validate content exists and has minimum length
        if (!content || typeof content !== "string") {
            return jsonResponse({ error: "Essay content is required" }, 400);
        }

        if (content.trim().length < 50) {
            return jsonResponse({ error: "Essay must be at least 50 characters" }, 400);
        }

        if (content.length > 50000) {
            return jsonResponse({ error: "Essay too long (max 50,000 characters)" }, 400);
        }

        // ============================================
        // AI INITIALIZATION (Only after auth passes)
        // ============================================

        const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

        if (!geminiApiKey) {
            console.error("[AI-Review] Missing GEMINI_API_KEY");
            return jsonResponse({ error: "AI service not configured" }, 500);
        }

        // GenAI client initialized ONLY HERE - after all auth checks
        const genAI = new GoogleGenerativeAI(geminiApiKey);

        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-pro",
            systemInstruction: `You are a Strict University Admissions Officer reviewing college application essays. 
Analyze this essay for:
1. LOGIC: Is the argument coherent and well-structured?
2. TONE: Is the voice authentic and appropriate for a college application?
3. IMPACT: Will this essay be memorable to an admissions committee?

Be critical but constructive. Your feedback should help the student improve.
Provide specific, actionable feedback referencing parts of the essay.`,
        });

        // ============================================
        // AI CALL WITH STRUCTURED OUTPUT
        // ============================================

        const prompt = `
Analyze the following ${essayType} essay (target: ${wordLimit} words).

ESSAY:
"""
${content}
"""

Respond with a JSON object in this exact format:
{
  "score": <number 0-100>,
  "critique": [<string>, <string>, ...],
  "improvements": [<string>, <string>, ...]
}

SCORING GUIDE:
- 90-100: Exceptional, publish-worthy
- 80-89: Strong, minor tweaks needed
- 70-79: Good foundation, needs work
- 60-69: Average, significant improvements needed
- Below 60: Needs major revision

Provide 3-5 critique points and 3-5 specific improvement suggestions.
Return ONLY the JSON object, no other text.`;

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.7,
                maxOutputTokens: 2048,
            },
        });

        const responseText = result.response.text();

        // ============================================
        // PARSE AND VALIDATE AI RESPONSE
        // ============================================

        let feedback: ReviewResponse;

        try {
            // Clean potential markdown wrapping
            let cleanedText = responseText.trim();
            cleanedText = cleanedText.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "");

            feedback = JSON.parse(cleanedText);

            // Validate structure
            if (typeof feedback.score !== "number") {
                feedback.score = 50;
            }
            feedback.score = Math.max(0, Math.min(100, Math.round(feedback.score)));

            if (!Array.isArray(feedback.critique)) {
                feedback.critique = ["Analysis unavailable"];
            }
            if (!Array.isArray(feedback.improvements)) {
                feedback.improvements = ["Please try again"];
            }

        } catch (parseError) {
            // DATA LEAKAGE PREVENTION: Never log the essay content
            console.error("[AI-Review] JSON parse failed:",
                parseError instanceof Error ? parseError.message : "Unknown parse error"
            );

            // Fallback response
            feedback = {
                score: 50,
                critique: ["AI analysis encountered an issue. Please try again."],
                improvements: ["Ensure your essay is complete and well-formatted."],
            };
        }

        // ============================================
        // SUCCESS RESPONSE
        // ============================================

        console.log("[AI-Review] Success for user:", user.id, "Score:", feedback.score);

        return jsonResponse(feedback, 200);

    } catch (error) {
        // CRITICAL: Never log essay content, only error metadata
        console.error("[AI-Review] Unhandled error:",
            error instanceof Error ? error.message : "Unknown error"
        );

        return jsonResponse({
            error: "AI review failed. Please try again.",
            code: "AI_ERROR"
        }, 500);
    }
});

// ============================================
// HELPER: JSON Response with CORS
// ============================================

function jsonResponse(data: ReviewResponse | ErrorResponse, status: number): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
        },
    });
}
