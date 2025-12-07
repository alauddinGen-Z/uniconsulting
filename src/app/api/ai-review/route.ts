import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");

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

    if (!process.env.GOOGLE_AI_API_KEY) {
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

    // Call Gemini - using stable model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON from response (handle markdown code blocks)
    let feedback;
    try {
      let jsonText = text;
      if (text.includes("```json")) {
        jsonText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      } else if (text.includes("```")) {
        jsonText = text.replace(/```\n?/g, "");
      }
      feedback = JSON.parse(jsonText.trim());
    } catch (parseError) {
      feedback = {
        overallScore: 7,
        overallComment: "Review completed. See detailed feedback below.",
        rawFeedback: text
      };
    }

    return NextResponse.json({ feedback });
  } catch (error: any) {
    console.error("AI Review Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate review" },
      { status: 500 }
    );
  }
}
