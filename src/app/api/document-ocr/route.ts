import { NextRequest, NextResponse } from 'next/server';
import { callGeminiWithRetry, GeminiAPIError } from '@/lib/gemini-client';
import { getOrFetchAIResponseServer } from '@/lib/ai-cache-server';

// Document OCR API - Extracts text and scores from academic documents
// Now with retry logic, proper error handling, and caching
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { imageBase64, documentType, mimeType } = body;

        console.log("OCR API called:", {
            hasImage: !!imageBase64,
            length: imageBase64?.length || 0,
            documentType,
            mimeType
        });

        if (!imageBase64) {
            return NextResponse.json({ success: false, error: "No image provided" }, { status: 400 });
        }

        // Validate that we have a Gemini API key
        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) {
            return NextResponse.json({ success: false, error: "GEMINI_API_KEY not configured" }, { status: 500 });
        }

        // Determine MIME type - try to detect from base64 header if not provided
        let fileMimeType = mimeType || detectMimeType(imageBase64) || "image/jpeg";

        // Normalize MIME types for Gemini
        if (fileMimeType.includes("pdf")) {
            fileMimeType = "application/pdf";
        } else if (fileMimeType.includes("jpeg") || fileMimeType.includes("jpg")) {
            fileMimeType = "image/jpeg";
        } else if (fileMimeType.includes("png")) {
            fileMimeType = "image/png";
        } else if (fileMimeType.includes("webp")) {
            fileMimeType = "image/webp";
        }

        console.log("Using MIME type:", fileMimeType);

        // Clean the base64 data (remove data URL prefix if present)
        let cleanBase64 = imageBase64;
        if (imageBase64.includes(',')) {
            cleanBase64 = imageBase64.split(',')[1];
        }

        // Validate base64
        if (!cleanBase64 || cleanBase64.length < 100) {
            return NextResponse.json({ success: false, error: "Invalid image data" }, { status: 400 });
        }

        // Build specialized prompt based on document type
        const prompt = buildPrompt(documentType);

        // Create cache key from document content + type
        const cacheInput = `${documentType}:${cleanBase64.substring(0, 1000)}`;

        // Call Gemini API with caching and retry logic
        let text: string;
        let fromCache = false;
        try {
            const result = await getOrFetchAIResponseServer<string>(
                cacheInput,
                'ocr',
                async () => {
                    return await callGeminiWithRetry(
                        geminiKey,
                        {
                            contents: [{
                                parts: [
                                    { text: prompt },
                                    {
                                        inline_data: {
                                            mime_type: fileMimeType,
                                            data: cleanBase64
                                        }
                                    }
                                ]
                            }],
                            generationConfig: {
                                temperature: 0.1,
                                maxOutputTokens: 2048
                            }
                        },
                        {
                            maxRetries: 3,
                            timeoutMs: 60000
                        }
                    );
                },
                30 // Cache for 30 days
            );
            text = result.data;
            fromCache = result.fromCache;
            console.log(`[OCR] Response received (fromCache: ${fromCache})`);
        } catch (error: any) {
            console.error("Gemini API error after retries:", error);
            const message = error instanceof GeminiAPIError
                ? error.message
                : "AI service temporarily unavailable. Please try again.";
            return NextResponse.json({
                success: false,
                error: message
            }, { status: error instanceof GeminiAPIError ? error.statusCode : 500 });
        }

        console.log("Extracted text from Gemini:", text.substring(0, 100));

        // Try to parse extracted scores from JSON response
        let extractedScores: Record<string, string> | undefined;

        if (documentType && documentType !== "other") {
            try {
                // First, try to find the complete JSON object using a greedy regex
                // This handles nested objects properly
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const jsonString = jsonMatch[0];
                    console.log("Found JSON string:", jsonString);
                    extractedScores = JSON.parse(jsonString);
                    console.log("Parsed extractedScores:", extractedScores);
                } else {
                    console.log("No JSON found in response, trying text extraction");
                    extractedScores = extractScoresFromText(text, documentType);
                }
            } catch (e) {
                console.log("JSON parse failed, using text extraction. Error:", e);
                extractedScores = extractScoresFromText(text, documentType);
            }
        }

        // Validate that extractedScores has actual values
        if (extractedScores) {
            const validScores: Record<string, string> = {};
            Object.entries(extractedScores).forEach(([key, value]) => {
                if (value !== null && value !== undefined && value !== '' && value !== 'null') {
                    validScores[key] = String(value);
                }
            });
            if (Object.keys(validScores).length > 0) {
                extractedScores = validScores;
                console.log("Valid extractedScores to return:", extractedScores);
            } else {
                extractedScores = undefined;
                console.log("No valid scores found after filtering");
            }
        }

        return NextResponse.json({
            success: true,
            text,
            extractedScores
        });


    } catch (error: any) {
        console.error("OCR API Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

function detectMimeType(base64: string): string | null {
    // Check for common file signatures in base64
    if (base64.startsWith('/9j/')) return 'image/jpeg';
    if (base64.startsWith('iVBORw')) return 'image/png';
    if (base64.startsWith('UklG')) return 'image/webp';
    if (base64.startsWith('JVBERi0')) return 'application/pdf';
    return null;
}

function buildPrompt(documentType?: string): string {
    if (documentType === "ielts") {
        return `Analyze this IELTS Test Report Form document. Extract the IELTS band scores.

Return ONLY a JSON object in this exact format (no other text):
{
    "ielts_overall": "7.5",
    "ielts_listening": "8.0",
    "ielts_reading": "7.5",
    "ielts_writing": "7.0",
    "ielts_speaking": "7.5"
}

Replace the example values with actual values from the document. If a score is not visible, use null.`;
    } else if (documentType === "gpa") {
        return `Analyze this academic transcript carefully. Extract ALL GPA information for each grade/year.

INSTRUCTIONS:
1. Find GPAs for each grade level: 9th grade, 10th grade, 11th grade, and 12th grade (if present)
2. Also look for a "Cumulative GPA" or "Overall GPA" or "CGPA"
3. If no cumulative GPA exists, calculate it as the average of all available year GPAs
4. Identify the grading scale from the legend (usually 4.0, 5.0, or 100)
5. IMPORTANT: Detect if this is an 11-grade or 12-grade school system based on what grades are shown

Return ONLY a JSON object in this exact format (no other text):
{
    "gpa_9th": "4.66",
    "gpa_10th": "4.89",
    "gpa_11th": "5.00",
    "gpa_12th": null,
    "gpa": "4.85",
    "gpa_scale": "5.0",
    "school_system": "11"
}

CRITICAL RULES:
- Extract the ACTUAL values you see - do NOT guess or make up values
- Use null for any grade that is not shown in the document
- The "gpa" field should be the cumulative/average GPA (calculate if needed)
- "school_system" should be "11" if only grades 9-11 are present, or "12" if grade 12 is also present
- Replace example values with actual values from the document`;
    } else if (documentType === "sat") {
        return `Analyze this SAT score report document. Extract the SAT scores.

Return ONLY a JSON object in this exact format (no other text):
{
    "sat_total": "1450",
    "sat_math": "750",
    "sat_reading": "700"
}

Replace with actual values. If not visible, use null.`;
    } else if (documentType === "toefl") {
        return `Analyze this TOEFL score report document. Extract the TOEFL score.

Return ONLY a JSON object in this exact format (no other text):
{
    "toefl_total": "110"
}

Replace with actual value. If not visible, use null.`;
    } else {
        return `Extract ALL text from this document. If it's an academic transcript, identify:
1. All subject names and their corresponding grades/scores
2. Any dates (enrollment, graduation, etc.)
3. Student name and ID if visible

Return the full extracted text first, then a structured summary.`;
    }
}

function extractScoresFromText(text: string, documentType: string): Record<string, string> {
    const scores: Record<string, string> = {};
    const normalizedText = text.toLowerCase();

    if (documentType === "ielts") {
        const overallMatch = normalizedText.match(/overall\s*(?:band\s*)?(?:score)?[:\s]*(\d+\.?\d*)/i);
        const listeningMatch = normalizedText.match(/listening[:\s]*(\d+\.?\d*)/i);
        const readingMatch = normalizedText.match(/reading[:\s]*(\d+\.?\d*)/i);
        const writingMatch = normalizedText.match(/writing[:\s]*(\d+\.?\d*)/i);
        const speakingMatch = normalizedText.match(/speaking[:\s]*(\d+\.?\d*)/i);

        if (overallMatch) scores.ielts_overall = overallMatch[1];
        if (listeningMatch) scores.ielts_listening = listeningMatch[1];
        if (readingMatch) scores.ielts_reading = readingMatch[1];
        if (writingMatch) scores.ielts_writing = writingMatch[1];
        if (speakingMatch) scores.ielts_speaking = speakingMatch[1];
    } else if (documentType === "sat") {
        const totalMatch = normalizedText.match(/total[:\s]*(\d{3,4})/i);
        const mathMatch = normalizedText.match(/math(?:ematics)?[:\s]*(\d{3})/i);
        const readingMatch = normalizedText.match(/(?:evidence-based\s*)?reading[:\s]*(\d{3})/i);

        if (totalMatch) scores.sat_total = totalMatch[1];
        if (mathMatch) scores.sat_math = mathMatch[1];
        if (readingMatch) scores.sat_reading = readingMatch[1];
    } else if (documentType === "toefl") {
        const totalMatch = normalizedText.match(/total[:\s]*(\d{2,3})/i);
        if (totalMatch) scores.toefl_total = totalMatch[1];
    } else if (documentType === "gpa") {
        const gpaMatch = normalizedText.match(/(?:cumulative\s*)?gpa[:\s]*(\d+\.?\d*)/i);
        if (gpaMatch) scores.gpa = gpaMatch[1];
    }

    return scores;
}
