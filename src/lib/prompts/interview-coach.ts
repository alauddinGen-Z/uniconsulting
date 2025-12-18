/**
 * Interview Coach System Prompt for Google Gemini 1.5 Pro
 * 
 * This prompt configures the Gemini model for multimodal analysis of
 * student interview performances, integrating video, audio, and text evaluation.
 * 
 * @module prompts/interview-coach
 */

export const INTERVIEW_COACH_SYSTEM_PROMPT = `You are the Expert Career Coach for UniConsulting, specializing in high-stakes international university admissions and professional demeanor analysis. Your primary function is to analyze student interview performance. Your judgment must be rigorous, fact-based, and adhere strictly to the Multimodal Analysis Protocol (MAP).

### I. PERSONA & CORE OBJECTIVE

1.  **ROLE:** Act as a critical, senior admissions committee member. Your feedback determines the student's readiness for competitive global university programs.
2.  **TONE:** Highly professional, direct, and constructive. Provide actionable advice, not generalized encouragement.
3.  **DOMAIN KNOWLEDGE:** All content evaluation must be contextualized by the requirements of demanding international programs (e.g., assessing depth of research, clarity of career goals, intellectual curiosity).

### II. MULTIMODAL ANALYSIS PROTOCOL (MAP)

You have simultaneous access to three streams of data (Video, Audio, and Text Transcription). Your final evaluation must integrate findings from ALL three modalities.

1.  **VIDEO ANALYSIS (Body Language):** Evaluate the candidate's non-verbal communication. Focus on:
    *   Eye Contact: Consistency and appropriateness.
    *   Posture: Confidence, openness, and engagement.
    *   Gestures: Avoidance of distracting or nervous habits.
    *   Observation Weight: This assessment is critical for the body_language_feedback field.

2.  **AUDIO ANALYSIS (Vocal Delivery):** Evaluate the quality of speech delivery. Focus on:
    *   Tone and Inflection: Presence of enthusiasm, conviction, and intellectual depth.
    *   Pace and Cadence: Smoothness and avoidance of excessive filler words or rambling.
    *   Volume: Projection and perceived confidence level (must map to the confidence_level enum).

3.  **TEXT ANALYSIS (Content and Logic):** Evaluate the substance of the responses. Focus on:
    *   Clarity and Structure: Logical flow (STAR method, etc.).
    *   Factual Accuracy: Consistency with stated goals and application materials.
    *   Relevance: Directness in answering the prompt without digression.

### III. STRUCTURED OUTPUT MANDATE (JSON SCHEMA)

You MUST return your complete analysis as a single JSON object that rigorously conforms to the schema below. DO NOT include any conversational preamble, explanation, or markdown outside of the JSON block.

FIELD CONSTRAINTS (ENUM ENFORCEMENT):
- overall_score: Integer (0-100).
- body_language_feedback: String. Must be a detailed narrative linking video observations to professional impact.
- content_improvements: Array of Strings (string[]). Must contain 3 to 5 highly specific, actionable suggestions for improving the substance of the answers.
- confidence_level: MUST be one of the following enumerated strings: "High", "Medium", or "Low". Do not accept any other value.`;

/**
 * TypeScript interface for Interview Coach response validation
 */
export interface InterviewCoachResponse {
    /** Overall performance score (0-100) */
    overall_score: number;
    /** Detailed body language analysis linking observations to impact */
    body_language_feedback: string;
    /** 3-5 specific, actionable content improvement suggestions */
    content_improvements: string[];
    /** Confidence level assessment based on vocal/visual analysis */
    confidence_level: 'High' | 'Medium' | 'Low';
}

/**
 * JSON Schema for runtime validation of Interview Coach responses
 */
export const INTERVIEW_COACH_RESPONSE_SCHEMA = {
    type: 'object',
    required: ['overall_score', 'body_language_feedback', 'content_improvements', 'confidence_level'],
    properties: {
        overall_score: {
            type: 'integer',
            minimum: 0,
            maximum: 100,
            description: 'Overall performance score'
        },
        body_language_feedback: {
            type: 'string',
            minLength: 50,
            description: 'Detailed body language analysis'
        },
        content_improvements: {
            type: 'array',
            items: { type: 'string' },
            minItems: 3,
            maxItems: 5,
            description: 'Actionable improvement suggestions'
        },
        confidence_level: {
            type: 'string',
            enum: ['High', 'Medium', 'Low'],
            description: 'Assessed confidence level'
        }
    },
    additionalProperties: false
} as const;

/**
 * Validate an Interview Coach response against the schema
 */
export function validateInterviewCoachResponse(
    response: unknown
): response is InterviewCoachResponse {
    if (!response || typeof response !== 'object') return false;

    const r = response as Record<string, unknown>;

    // Validate overall_score
    if (typeof r.overall_score !== 'number' || r.overall_score < 0 || r.overall_score > 100) {
        return false;
    }

    // Validate body_language_feedback
    if (typeof r.body_language_feedback !== 'string' || r.body_language_feedback.length < 50) {
        return false;
    }

    // Validate content_improvements
    if (!Array.isArray(r.content_improvements) ||
        r.content_improvements.length < 3 ||
        r.content_improvements.length > 5 ||
        !r.content_improvements.every(item => typeof item === 'string')) {
        return false;
    }

    // Validate confidence_level (enum)
    if (!['High', 'Medium', 'Low'].includes(r.confidence_level as string)) {
        return false;
    }

    return true;
}

/**
 * Example usage for Interview Coach integration
 * 
 * @example
 * ```typescript
 * import { GoogleGenerativeAI } from '@google/generative-ai';
 * import { INTERVIEW_COACH_SYSTEM_PROMPT, validateInterviewCoachResponse } from './prompts/interview-coach';
 * 
 * const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
 * const model = genAI.getGenerativeModel({ 
 *   model: 'gemini-1.5-pro',
 *   systemInstruction: INTERVIEW_COACH_SYSTEM_PROMPT
 * });
 * 
 * const result = await model.generateContent({
 *   contents: [{ role: 'user', parts: [videoPart, audioPart, textPart] }]
 * });
 * 
 * const response = JSON.parse(result.response.text());
 * if (validateInterviewCoachResponse(response)) {
 *   // Safe to use response.overall_score, etc.
 * }
 * ```
 */
