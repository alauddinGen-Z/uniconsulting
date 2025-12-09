// Supabase Edge Function: Document OCR
// Uses Google Cloud Vision API to extract text from images
// Deploy with: supabase functions deploy document-ocr

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OCRRequest {
    imageBase64?: string;
    imageUrl?: string;
    documentType?: 'ielts' | 'gpa' | 'sat' | 'toefl' | 'passport' | 'portrait' | 'other';
    mimeType?: string;
}

interface ExtractedScores {
    // IELTS scores
    ielts_overall?: string;
    ielts_listening?: string;
    ielts_reading?: string;
    ielts_writing?: string;
    ielts_speaking?: string;
    // GPA scores (cumulative)
    gpa?: string;
    gpa_scale?: string;
    // Individual year GPAs
    gpa_9th?: string;
    gpa_10th?: string;
    gpa_11th?: string;
    gpa_12th?: string;
    // SAT scores
    sat_total?: string;
    sat_math?: string;
    sat_reading?: string;
    // TOEFL scores
    toefl_total?: string;
    // Passport info
    full_name?: string;
    passport_number?: string;
    nationality?: string;
    date_of_birth?: string;
    passport_expiry?: string;
    gender?: string;
    city_of_birth?: string;
    // School system
    school_system?: string;
}

interface OCRResponse {
    success: boolean;
    text?: string;
    structuredData?: {
        grades?: Array<{ subject: string; score: string }>;
        dates?: string[];
        names?: string[];
    };
    extractedScores?: ExtractedScores;
    error?: string;
}

serve(async (req: Request) => {
    console.log("=== Document OCR Function Called ===");
    console.log("Method:", req.method);

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { imageBase64, imageUrl, documentType, mimeType }: OCRRequest = body;

        console.log("Request received:");
        console.log("- Has imageBase64:", !!imageBase64);
        console.log("- imageBase64 length:", imageBase64?.length || 0);
        console.log("- Has imageUrl:", !!imageUrl);
        console.log("- documentType:", documentType);
        console.log("- mimeType:", mimeType);

        if (!imageBase64 && !imageUrl) {
            console.log("Error: No image provided");
            return new Response(
                JSON.stringify({ success: false, error: "No image provided" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Always use Gemini for now (simpler and more reliable)
        console.log("Processing with Gemini Vision API...");
        const result = await processWithGemini(imageBase64, imageUrl, documentType, mimeType);

        console.log("Result:", JSON.stringify(result).substring(0, 300));

        return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        console.error("OCR Error:", error.message);
        console.error("Stack:", error.stack);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

// Process with Google Cloud Vision API
async function processWithVisionAPI(
    imageBase64?: string,
    imageUrl?: string,
    serviceAccountKey?: string
): Promise<OCRResponse> {
    const key = JSON.parse(serviceAccountKey!);

    // Get access token using service account
    const tokenResponse = await fetch(
        `https://oauth2.googleapis.com/token`,
        {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
                assertion: await createJWT(key),
            }),
        }
    );

    const { access_token } = await tokenResponse.json();

    // Prepare Vision API request
    const imageContent = imageBase64
        ? { content: imageBase64 }
        : { source: { imageUri: imageUrl } };

    const visionResponse = await fetch(
        "https://vision.googleapis.com/v1/images:annotate",
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${access_token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                requests: [{
                    image: imageContent,
                    features: [
                        { type: "TEXT_DETECTION" },
                        { type: "DOCUMENT_TEXT_DETECTION" }
                    ]
                }]
            }),
        }
    );

    const result = await visionResponse.json();

    if (result.responses?.[0]?.error) {
        return { success: false, error: result.responses[0].error.message };
    }

    const fullText = result.responses?.[0]?.fullTextAnnotation?.text ||
        result.responses?.[0]?.textAnnotations?.[0]?.description || "";

    // Extract structured data from text
    const structuredData = extractStructuredData(fullText);

    return {
        success: true,
        text: fullText,
        structuredData
    };
}

// Process with Gemini Vision (specialized prompts for different document types)
async function processWithGemini(imageBase64?: string, imageUrl?: string, documentType?: string, mimeType?: string): Promise<OCRResponse> {
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiKey) {
        return { success: false, error: "No API keys configured" };
    }

    let imageData = imageBase64;

    // If URL provided, fetch and convert to base64
    if (imageUrl && !imageBase64) {
        try {
            const imageResponse = await fetch(imageUrl);
            const arrayBuffer = await imageResponse.arrayBuffer();
            imageData = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        } catch (e) {
            return { success: false, error: "Failed to fetch image from URL" };
        }
    }

    // Determine the correct MIME type
    // Gemini supports: image/png, image/jpeg, image/webp, image/heic, image/heif, application/pdf
    let fileMimeType = mimeType || "image/png";

    // Normalize MIME types
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

    // Build specialized prompt based on document type
    let prompt = "";

    if (documentType === "ielts") {
        prompt = `Analyze this IELTS Test Report Form document. Extract the IELTS band scores.

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
        prompt = `Analyze this academic transcript carefully. Extract ALL GPA information for each grade/year.

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
        prompt = `Analyze this SAT score report document. Extract the SAT scores.

Return ONLY a JSON object in this exact format (no other text):
{
    "sat_total": "1450",
    "sat_math": "750",
    "sat_reading": "700"
}

Replace with actual values. If not visible, use null.`;
    } else if (documentType === "toefl") {
        prompt = `Analyze this TOEFL score report document. Extract the TOEFL score.

Return ONLY a JSON object in this exact format (no other text):
{
    "toefl_total": "110"
}

Replace with actual value. If not visible, use null.`;
    } else if (documentType === "passport") {
        prompt = `Analyze this passport document carefully. Extract the personal information.

IMPORTANT: Many passports have text in BOTH local language (Cyrillic, Arabic, Chinese, etc.) AND English/Latin letters.
You MUST extract ONLY the ENGLISH/LATIN version of each field. Ignore any Cyrillic, Arabic, or non-Latin text.

For example:
- If you see "ЖАМШИТБЕКОВ / ZHAMSHITBEKOV", extract only "ZHAMSHITBEKOV"
- If you see "АЛАУДДИН / ALAUDDIN", extract only "ALAUDDIN"
- Combine surname and given name as: "SURNAME GIVENNAME" (e.g., "ZHAMSHITBEKOV ALAUDDIN")

Return ONLY a JSON object in this exact format (no other text):
{
    "full_name": "ZHAMSHITBEKOV ALAUDDIN",
    "passport_number": "AB1234567",
    "nationality": "UZBEKISTAN",
    "date_of_birth": "1990-05-15",
    "passport_expiry": "2030-05-14",
    "gender": "male",
    "city_of_birth": "TASHKENT"
}

CRITICAL RULES:
- Use ONLY English/Latin letters - NO Cyrillic, Arabic, or other scripts
- For full_name: combine SURNAME and GIVEN NAME(S) in English only
- For dates, use YYYY-MM-DD format
- For gender, use "male" or "female" (lowercase)
- For nationality and city_of_birth, use the English name
- If a field is not visible, use null`;
    } else if (documentType === "portrait") {
        prompt = `This is a portrait photo. Just confirm it shows a person's face.

Return ONLY a JSON object:
{
    "is_valid_portrait": true,
    "notes": "Clear portrait photo suitable for applications"
}

Return is_valid_portrait as false if the image is not a proper portrait photo.`;
    } else {
        prompt = `Extract ALL text from this document. If it's an academic transcript, identify:
1. All subject names and their corresponding grades/scores
2. Any dates (enrollment, graduation, etc.)
3. Student name and ID if visible

Return the full extracted text first, then a structured summary.`;
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: fileMimeType,
                                data: imageData
                            }
                        }
                    ]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 2048
                }
            }),
        }
    );

    const result = await response.json();

    // Debug logging
    console.log("Gemini API Response status:", response.status);
    console.log("Gemini API Result:", JSON.stringify(result).substring(0, 500));

    // Check for API errors
    if (result.error) {
        console.error("Gemini API Error:", result.error);
        return { success: false, error: result.error.message || "Gemini API error" };
    }

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("Extracted text:", text.substring(0, 200));

    // Try to parse extracted data from JSON response
    let extractedScores: ExtractedScores | undefined;

    if (documentType && documentType !== "other") {
        try {
            // Try to extract JSON from the response - use greedy match for nested objects
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                console.log("Found JSON string:", jsonMatch[0]);
                extractedScores = JSON.parse(jsonMatch[0]);
                console.log("Parsed extracted data:", extractedScores);
            } else {
                console.log("No JSON found in response, trying text extraction");
                extractedScores = extractScoresFromText(text, documentType);
            }
        } catch (e) {
            console.log("JSON parse failed:", e);
            console.log("Falling back to text extraction for:", documentType);
            extractedScores = extractScoresFromText(text, documentType);
        }
    }

    return {
        success: true,
        text,
        structuredData: extractStructuredData(text),
        extractedScores
    };
}

// Extract specific scores from text based on document type
function extractScoresFromText(text: string, documentType: string): ExtractedScores {
    const scores: ExtractedScores = {};
    const normalizedText = text.toLowerCase();

    if (documentType === "ielts") {
        // IELTS patterns
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
    } else if (documentType === "gpa") {
        // GPA patterns
        const gpaMatch = normalizedText.match(/(?:cumulative\s*)?gpa[:\s]*(\d+\.?\d*)/i) ||
            normalizedText.match(/(\d+\.\d+)\s*(?:out of|\/)\s*(\d+\.?\d*)/i);
        const scaleMatch = normalizedText.match(/(?:out of|\/|scale)[:\s]*(\d+\.?\d*)/i);

        if (gpaMatch) {
            scores.gpa = gpaMatch[1];
            if (gpaMatch[2]) scores.gpa_scale = gpaMatch[2];
        }
        if (scaleMatch && !scores.gpa_scale) scores.gpa_scale = scaleMatch[1];
    } else if (documentType === "sat") {
        // SAT patterns
        const totalMatch = normalizedText.match(/total[:\s]*(\d{3,4})/i) ||
            normalizedText.match(/composite[:\s]*(\d{3,4})/i);
        const mathMatch = normalizedText.match(/math(?:ematics)?[:\s]*(\d{3})/i);
        const readingMatch = normalizedText.match(/(?:evidence-based\s*)?reading[:\s]*(\d{3})/i) ||
            normalizedText.match(/ebrw[:\s]*(\d{3})/i);

        if (totalMatch) scores.sat_total = totalMatch[1];
        if (mathMatch) scores.sat_math = mathMatch[1];
        if (readingMatch) scores.sat_reading = readingMatch[1];
    } else if (documentType === "toefl") {
        // TOEFL patterns
        const totalMatch = normalizedText.match(/total[:\s]*(\d{2,3})/i) ||
            normalizedText.match(/score[:\s]*(\d{2,3})/i);
        if (totalMatch) scores.toefl_total = totalMatch[1];
    }

    return scores;
}

// Extract structured data from OCR text
function extractStructuredData(text: string) {
    const grades: Array<{ subject: string; score: string }> = [];
    const dates: string[] = [];
    const names: string[] = [];

    // Extract grades (pattern: Subject Name followed by score)
    const gradePatterns = [
        /([A-Za-z\s]+)\s*[:：]\s*([A-F][+-]?|\d{1,3}(?:\.\d+)?%?)/g,
        /([A-Za-z\s]+)\s+(\d{1,3}(?:\.\d+)?)/g
    ];

    for (const pattern of gradePatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const subject = match[1].trim();
            const score = match[2].trim();
            if (subject.length > 2 && subject.length < 50) {
                grades.push({ subject, score });
            }
        }
    }

    // Extract dates
    const datePattern = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/gi;
    let dateMatch;
    while ((dateMatch = datePattern.exec(text)) !== null) {
        dates.push(dateMatch[1]);
    }

    return { grades, dates, names };
}

// Create JWT for Google OAuth
async function createJWT(serviceAccount: any): Promise<string> {
    const header = { alg: "RS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const claim = {
        iss: serviceAccount.client_email,
        scope: "https://www.googleapis.com/auth/cloud-vision",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600
    };

    const encoder = new TextEncoder();
    const headerB64 = btoa(JSON.stringify(header));
    const claimB64 = btoa(JSON.stringify(claim));
    const signatureInput = `${headerB64}.${claimB64}`;

    // Import private key
    const pemKey = serviceAccount.private_key;
    const pemContents = pemKey
        .replace("-----BEGIN PRIVATE KEY-----", "")
        .replace("-----END PRIVATE KEY-----", "")
        .replace(/\n/g, "");

    const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
        "pkcs8",
        binaryKey,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
    );

    const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        cryptoKey,
        encoder.encode(signatureInput)
    );

    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

    return `${signatureInput}.${signatureB64}`;
}
