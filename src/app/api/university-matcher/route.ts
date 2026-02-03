import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { callGeminiWithRetry, GeminiAPIError } from '@/lib/gemini-client';
import { getOrFetchAIResponseServer } from '@/lib/ai-cache-server';

// University Matcher API - Now with retry logic, proper error handling, and caching

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { studentId } = body;

        if (!studentId) {
            return NextResponse.json(
                { success: false, error: 'Student ID required' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        // Get current user to verify they're a teacher
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized - please log in' },
                { status: 401 }
            );
        }

        // Verify user is a teacher
        const { data: teacherProfile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (teacherProfile?.role !== 'teacher') {
            return NextResponse.json(
                { success: false, error: 'Only teachers can use AI matcher' },
                { status: 403 }
            );
        }

        // Fetch student profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', studentId)
            .single();

        if (profileError || !profile) {
            return NextResponse.json(
                { success: false, error: 'Student not found' },
                { status: 404 }
            );
        }

        // Fetch existing universities
        const { data: existingUnis } = await supabase
            .from('student_universities')
            .select('university_name')
            .eq('student_id', studentId);

        // Build student summary
        const gpaDetails = [];
        if (profile.gpa) gpaDetails.push(`Cumulative: ${profile.gpa}/${profile.gpa_scale || '4.0'}`);
        if (profile.gpa_9th) gpaDetails.push(`9th: ${profile.gpa_9th}`);
        if (profile.gpa_10th) gpaDetails.push(`10th: ${profile.gpa_10th}`);
        if (profile.gpa_11th) gpaDetails.push(`11th: ${profile.gpa_11th}`);
        if (profile.gpa_12th) gpaDetails.push(`12th: ${profile.gpa_12th}`);
        const gpaString = gpaDetails.length > 0 ? gpaDetails.join(", ") : "Not provided";

        const satString = profile.sat_total
            ? `${profile.sat_total} (Math: ${profile.sat_math || 'N/A'}, Reading: ${profile.sat_reading || 'N/A'})`
            : "Not taken";

        const ieltsString = profile.ielts_overall
            ? `${profile.ielts_overall} (L:${profile.ielts_listening || 'N/A'} R:${profile.ielts_reading || 'N/A'} W:${profile.ielts_writing || 'N/A'} S:${profile.ielts_speaking || 'N/A'})`
            : "Not taken";

        const existingUniNames = existingUnis?.map(u => u.university_name).join(", ") || "";
        const targetCountries = profile.preferred_country || 'USA, UK, Canada, Australia';

        const prompt = `You are a highly knowledgeable university admissions expert specializing in international student placements. Based on this student's COMPLETE profile, recommend the TOP 5 best-fit universities.

=== STUDENT PROFILE ===

BACKGROUND:
- Name: ${profile.full_name || 'Unknown'}
- Origin Country: ${profile.nationality || profile.country || 'Unknown'}
- International Student: YES

ACADEMIC PERFORMANCE:
- GPA: ${gpaString}

STANDARDIZED TEST SCORES:
- SAT: ${satString}
- TOEFL: ${profile.toefl_total || "Not taken"}
- IELTS: ${ieltsString}

PREFERENCES:
- Target Countries/Regions: ${targetCountries}
- Field of Study: ${profile.preferred_major || profile.intended_major || 'Undecided'}
- Degree Level: undergraduate
${profile.preferred_university ? `- Dream University: ${profile.preferred_university}` : ''}

${existingUniNames ? `Already Considering: ${existingUniNames}` : ""}

=== MATCHING CRITERIA ===

Consider these factors when ranking universities:
1. ACADEMIC FIT: Does the student's GPA and test scores meet or exceed typical admitted student profiles?
2. INTERNATIONAL SUPPORT: Strong international student programs, ESL support, visa assistance
3. SCHOLARSHIPS: Availability of merit scholarships for international students
4. PROGRAM STRENGTH: Quality of the program in student's preferred field
5. LOCATION: Match with student's preferred countries/regions
6. REALISTIC CHANCES: Categorize as Safety (high chance), Match (good chance), or Reach (competitive)

=== RESPONSE FORMAT ===

Return ONLY valid JSON in this exact format:
{
  "matches": [
    {
      "name": "University Name",
      "country": "Country",
      "matchScore": 85,
      "reasons": ["Specific reason 1 based on profile", "Specific reason 2"],
      "requirements": "Typical admitted student GPA/SAT/IELTS requirements",
      "tuitionRange": "$XX,XXX - $XX,XXX per year"
    }
  ],
  "summary": "2-sentence personalized summary explaining the recommendations"
}`;

        // Get API key
        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) {
            return NextResponse.json(
                { success: false, error: 'AI service not configured - missing GEMINI_API_KEY' },
                { status: 500 }
            );
        }

        // Create cache key from student profile data (v4 = increased token limit)
        const cacheInput = `matcher_v4:${studentId}:${profile.gpa || ''}:${profile.sat_total || ''}:${profile.ielts_overall || ''}:${profile.preferred_major || ''}`;

        // Call Gemini API with caching and retry logic
        let content: string;
        let fromCache = false;
        try {
            console.log('[University Matcher] Starting AI request for student:', studentId);
            const result = await getOrFetchAIResponseServer<string>(
                cacheInput,
                'university_match',
                async () => {
                    console.log('[University Matcher] Calling Gemini API with JSON schema...');
                    return await callGeminiWithRetry(
                        geminiKey,
                        {
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: {
                                temperature: 0.7,
                                maxOutputTokens: 8192,
                                responseMimeType: 'application/json',
                                responseSchema: {
                                    type: 'object',
                                    properties: {
                                        matches: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    name: { type: 'string' },
                                                    country: { type: 'string' },
                                                    matchScore: { type: 'number' },
                                                    reasons: { type: 'array', items: { type: 'string' } },
                                                    requirements: { type: 'string' },
                                                    tuitionRange: { type: 'string' }
                                                },
                                                required: ['name', 'country', 'matchScore', 'reasons']
                                            }
                                        },
                                        summary: { type: 'string' }
                                    },
                                    required: ['matches', 'summary']
                                }
                            }
                        },
                        {
                            maxRetries: 3,
                            timeoutMs: 60000
                        }
                    );
                },
                7 // Cache for 7 days (student profile may change)
            );
            content = result.data;
            fromCache = result.fromCache;
            console.log(`[University Matcher] Response received (fromCache: ${fromCache})`);
        } catch (error: any) {
            console.error('[University Matcher] Gemini API error after retries:', error);
            const message = error instanceof GeminiAPIError
                ? error.message
                : 'AI service temporarily unavailable. Please try again.';
            return NextResponse.json(
                { success: false, error: message },
                { status: error instanceof GeminiAPIError ? error.statusCode : 500 }
            );
        }

        // Parse the response - handle markdown code blocks from Gemini
        try {
            console.log('[University Matcher] ==================== DEBUG START ====================');
            console.log('[University Matcher] Raw content type:', typeof content);
            console.log('[University Matcher] Raw content length:', content?.length);
            console.log('[University Matcher] Raw content first 1000 chars:', content?.substring(0, 1000));
            console.log('[University Matcher] ==================== DEBUG END ====================');

            // First, clean up the content - remove markdown code blocks if present
            let cleanContent = content || '';

            // Remove ```json ... ``` or ``` ... ``` wrapper
            const codeBlockMatch = cleanContent.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (codeBlockMatch) {
                console.log('[University Matcher] Found code block wrapper, extracting content');
                cleanContent = codeBlockMatch[1].trim();
            }

            // Remove any leading/trailing whitespace and newlines
            cleanContent = cleanContent.trim();

            console.log('[University Matcher] Clean content starts with:', cleanContent.substring(0, 100));

            // Try to parse the cleaned content
            const parsed = JSON.parse(cleanContent);
            console.log('[University Matcher] Successfully parsed AI response');
            return NextResponse.json({
                success: true,
                matches: parsed.matches || [],
                summary: parsed.summary || "",
                fromCache
            });
        } catch (parseError: any) {
            console.error('[University Matcher] ==================== PARSE ERROR ====================');
            console.error('[University Matcher] Parse error message:', parseError?.message);
            console.error('[University Matcher] Content type:', typeof content);
            console.error('[University Matcher] Content is null/undefined:', content == null);
            console.error('[University Matcher] Content first 500 chars:', content?.substring(0, 500));
            console.error('[University Matcher] ==================== PARSE ERROR END ====================');

            // Fallback: Try to extract JSON object from response
            const jsonMatch = content?.match(/\{[\s\S]*"matches"[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    const parsed = JSON.parse(jsonMatch[0]);
                    console.log('[University Matcher] Extracted JSON via regex fallback');
                    return NextResponse.json({
                        success: true,
                        matches: parsed.matches || [],
                        summary: parsed.summary || "",
                        fromCache
                    });
                } catch {
                    // Fallback failed too
                    console.error('[University Matcher] Regex fallback also failed');
                }
            }

            return NextResponse.json(
                {
                    success: false,
                    error: 'Failed to parse AI response. Please try again.',
                    debug: {
                        contentType: typeof content,
                        contentLength: content?.length || 0,
                        contentPreview: content?.substring(0, 300) || 'NO CONTENT',
                        parseError: parseError?.message || 'Unknown error'
                    }
                },
                { status: 500 }
            );
        }

    } catch (error) {
        console.error('[University Matcher] API error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

