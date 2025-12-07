// Supabase Edge Function: AI Essay Review (Coach Mode)
// Uses Google Gemini to provide coaching feedback on essays
// Deploy with: supabase functions deploy ai-review

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReviewRequest {
    content: string;
    essayType?: string;
    wordLimit?: number;
}

interface AIFeedback {
    overallScore: number;
    overallComment: string;
    strengths?: { point: string; explanation: string }[];
    improvements?: { issue: string; suggestion: string; priority: string }[];
    structure?: { score: number; feedback: string };
    voice?: { score: number; feedback: string };
    impact?: { score: number; feedback: string };
    grammarIssues?: { text: string; suggestion: string }[];
    coachingPrompts?: string[];
    pickupTestFlags?: { sentence: string; reason: string }[];
    rawFeedback?: string;
}

serve(async (req: Request) => {
    console.log("=== AI Essay Review Function Called ===");

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { content, essayType, wordLimit }: ReviewRequest = await req.json();

        if (!content || content.trim().length < 50) {
            return new Response(
                JSON.stringify({ error: "Essay content must be at least 50 characters" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const geminiKey = Deno.env.get("GEMINI_API_KEY");
        if (!geminiKey) {
            return new Response(
                JSON.stringify({ error: "AI service not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Coach Mode Prompt - focuses on guiding rather than rewriting
        const coachPrompt = `You are an expert college admissions essay COACH (not a rewriter).
Your role is to help students improve their essays by asking the right questions and pointing out areas for improvement.

CRITICAL RULES:
1. NEVER rewrite sentences for the student - instead, ask prompting questions
2. Focus on the "SHOW, DON'T TELL" principle - flag statements that tell instead of showing
3. Apply the "PICKUP TEST" - flag generic sentences that any student could have written
4. Be encouraging but honest
5. Prioritize improvements by impact

Essay Type: ${essayType || 'Common App'}
Word Limit: ${wordLimit || 650}

STUDENT'S ESSAY:
"""
${content}
"""

Analyze this essay and return a JSON response in this EXACT format:
{
    "overallScore": 7,
    "overallComment": "Your essay shows promise with [strength], but needs work on [area]. Let's dig deeper.",
    "structure": {
        "score": 7,
        "feedback": "Brief feedback on essay structure and flow"
    },
    "voice": {
        "score": 6,
        "feedback": "Brief feedback on authenticity and personal voice"
    },
    "impact": {
        "score": 7,
        "feedback": "Brief feedback on memorability and emotional impact"
    },
    "strengths": [
        {
            "point": "Strong opening hook",
            "explanation": "Why this works well"
        }
    ],
    "improvements": [
        {
            "issue": "This section could be more specific",
            "suggestion": "Instead of telling us you're a leader, can you describe a specific moment where you demonstrated leadership? What did you do? How did it feel?",
            "priority": "high"
        }
    ],
    "pickupTestFlags": [
        {
            "sentence": "The exact generic sentence from the essay",
            "reason": "Why this fails the pickup test and how to make it unique"
        }
    ],
    "coachingPrompts": [
        "What specific moment made you passionate about this?",
        "Can you describe what you saw, heard, or felt in that experience?",
        "What would your best friend say about this experience?"
    ],
    "grammarIssues": [
        {
            "text": "Incorrect text",
            "suggestion": "Corrected version"
        }
    ]
}

SCORING GUIDE (1-10):
- 9-10: Exceptional, publication-worthy
- 7-8: Strong, minor improvements needed
- 5-6: Good foundation, significant improvements needed
- 3-4: Needs major rework
- 1-2: Start from scratch

SHOW DON'T TELL EXAMPLES:
- BAD: "I am a natural leader" (telling)
- GOOD: "When our project deadline loomed, I gathered the team at 6 AM..." (showing)

PICKUP TEST:
A sentence fails if any other applicant could have written it. It should be SO SPECIFIC that it could ONLY come from this student's life.

Return ONLY the JSON object, no other text.`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: coachPrompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 4096
                    }
                }),
            }
        );

        const result = await response.json();

        if (result.error) {
            console.error("Gemini API Error:", result.error);
            return new Response(
                JSON.stringify({ error: result.error.message || "AI service error" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
        console.log("Raw Gemini response:", text.substring(0, 500));

        // Parse JSON from response - handle various formats
        let feedback: AIFeedback;
        try {
            // Step 1: Clean up the response - remove markdown code blocks if present
            let cleanedText = text.trim();

            // Remove ```json ... ``` or ``` ... ``` wrappers
            cleanedText = cleanedText.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');

            // Step 2: Try to find JSON object in the response
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonStr = jsonMatch[0];
                feedback = JSON.parse(jsonStr);

                // Validate required fields
                if (typeof feedback.overallScore !== 'number') {
                    feedback.overallScore = 5;
                }
                if (!feedback.overallComment || typeof feedback.overallComment !== 'string') {
                    feedback.overallComment = "Review completed.";
                }

                console.log("Successfully parsed feedback with score:", feedback.overallScore);
            } else {
                throw new Error("No JSON object found in response");
            }
        } catch (e: any) {
            console.log("JSON parse failed:", e.message, "Using raw feedback");
            // Fallback: extract key information from text
            feedback = {
                overallScore: 5,
                overallComment: "Analysis complete. The AI provided feedback below.",
                rawFeedback: text.replace(/```json?\s*/gi, '').replace(/```/g, '').trim()
            };
        }

        return new Response(
            JSON.stringify({ feedback }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        console.error("AI Review Error:", error.message);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
