import { NextRequest, NextResponse } from "next/server";
import { callGeminiWithRetry, GeminiAPIError } from "@/lib/gemini-client";
import { getOrFetchAIResponseServer } from "@/lib/ai-cache-server";

// AI Essay Review API - Now with retry logic, proper error handling, and caching

const ESSAY_REVIEW_PROMPT = `You are an expert college admissions consultant specializing in personal statements and application essays. 

Analyze the following essay and provide detailed, actionable feedback. Structure your response in JSON format with these sections:

{
  "overallScore": <number 1-10>,
  "overallComment": "<brief 2-sentence summary>",
  "strengths": [
    {"point": "<strength>", "explanation": "<why this works>"}
  ],
  "improvements": [
    {"issue": "<problem>", "suggestion": "<how to fix>", "priority": "<high/medium/low>"}
  ],
  "structure": {
    "score": <1-10>,
    "feedback": "<structure feedback>"
  },
  "voice": {
    "score": <1-10>,
    "feedback": "<authenticity/voice feedback>"
  },
  "impact": {
    "score": <1-10>,
    "feedback": "<emotional impact feedback>"
  },
  "grammarIssues": [
    {"text": "<problematic text>", "suggestion": "<correction>"}
  ],
  "suggestedOpening": "<optional: if opening is weak, suggest alternative>",
  "suggestedClosing": "<optional: if closing is weak, suggest alternative>"
}

Essay Type: {{ESSAY_TYPE}}
Word/Character Limit: {{LIMIT}}

ESSAY TO REVIEW:
"""
{{ESSAY_CONTENT}}
"""

Provide honest, constructive feedback that will help this student improve their essay. Focus on making the essay more compelling for admissions officers.`;

export async function POST(request: NextRequest) {
  try {
    const { content, essayType = "Common App", wordLimit = 650 } = await request.json();

    if (!content || content.trim().length < 50) {
      return NextResponse.json(
        { error: "Essay content is too short for meaningful review" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 500 }
      );
    }

    // Prepare prompt
    const prompt = ESSAY_REVIEW_PROMPT
      .replace("{{ESSAY_TYPE}}", essayType)
      .replace("{{LIMIT}}", essayType === "UCAS" ? "4000 characters / 47 lines" : `${wordLimit} words`)
      .replace("{{ESSAY_CONTENT}}", content);

    // Call Gemini with caching and retry logic
    let text: string;
    let fromCache = false;
    try {
      const result = await getOrFetchAIResponseServer<string>(
        content, // Use essay content as cache key
        'essay_review',
        async () => {
          return await callGeminiWithRetry(
            apiKey,
            {
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 4096
              }
            },
            {
              maxRetries: 3,
              timeoutMs: 60000
            }
          );
        },
        7 // Cache for 7 days (essays may be edited)
      );
      text = result.data;
      fromCache = result.fromCache;
      console.log(`[AI Review] Response received (fromCache: ${fromCache})`);
    } catch (error: any) {
      console.error("[AI Review] Gemini API error after retries:", error);
      const message = error instanceof GeminiAPIError
        ? error.message
        : "AI service temporarily unavailable. Please try again.";
      return NextResponse.json(
        { error: message },
        { status: error instanceof GeminiAPIError ? error.statusCode : 500 }
      );
    }

    // Parse JSON from response (handle markdown code blocks)
    let feedback;
    try {
      let jsonText = text;

      // Try to extract JSON from markdown code blocks
      const jsonBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonBlockMatch) {
        jsonText = jsonBlockMatch[1];
      } else if (text.includes("```")) {
        // Fallback: remove all backticks
        jsonText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      }

      // Also try to find raw JSON object
      if (!jsonText.trim().startsWith("{")) {
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
        }
      }

      feedback = JSON.parse(jsonText.trim());
      console.log("[AI Review] JSON parsed successfully");
    } catch (parseError) {
      console.log("[AI Review] JSON parse failed, using raw feedback:", parseError);
      feedback = {
        overallScore: 7,
        overallComment: "Review completed. See detailed feedback below.",
        rawFeedback: text
      };
    }

    return NextResponse.json({ feedback });
  } catch (error: any) {
    console.error("[AI Review] Unexpected error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate review" },
      { status: 500 }
    );
  }
}

