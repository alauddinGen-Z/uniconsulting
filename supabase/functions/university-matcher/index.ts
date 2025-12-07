// Supabase Edge Function: University Matcher
// Uses Gemini AI to recommend universities based on student profile
// Deploy with: supabase functions deploy university-matcher

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MatcherRequest {
    studentId: string;
    preferences?: {
        regions?: string[];  // 'asia', 'europe', 'north_america', 'oceania', 'middle_east'
        countries?: string[];
        budget?: 'low' | 'medium' | 'high' | 'full_scholarship';
        fieldOfStudy?: string;
        degreeLevel?: 'undergraduate' | 'graduate' | 'phd';
        programType?: string;  // e.g., 'computer_science', 'business', 'engineering'
    };
}

interface UniversityMatch {
    name: string;
    country: string;
    matchScore: number;
    reasons: string[];
    requirements: string;
    tuitionRange: string;
    website?: string;
}

interface MatcherResponse {
    success: boolean;
    matches?: UniversityMatch[];
    summary?: string;
    error?: string;
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = await req.json().catch(() => ({}));
        let studentId = body.studentId;
        const preferences = body.preferences;

        // Initialize Supabase client
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // If no studentId provided, try to extract from auth token
        if (!studentId) {
            const authHeader = req.headers.get("Authorization");
            if (authHeader) {
                const token = authHeader.replace("Bearer ", "");
                const { data: { user }, error } = await supabase.auth.getUser(token);
                if (user && !error) {
                    studentId = user.id;
                }
            }
        }

        if (!studentId) {
            return new Response(
                JSON.stringify({ success: false, error: "Student ID required - please log in" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Fetch student profile
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", studentId)
            .single();

        if (profileError || !profile) {
            return new Response(
                JSON.stringify({ success: false, error: "Student not found" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log("Student profile found:", profile.full_name);
        console.log("GPA data:", profile.gpa, profile.gpa_9th, profile.gpa_10th, profile.gpa_11th);
        console.log("Test scores:", profile.sat_total, profile.ielts_overall);

        // Fetch target universities from student_universities table (if any saved)
        const { data: targetUnis } = await supabase
            .from("student_universities")
            .select("*")
            .eq("student_id", studentId);

        console.log("Existing universities:", targetUnis?.length || 0);

        // Build student profile summary (scores are in the profiles table)
        const studentSummary = buildStudentSummary(profile, preferences);
        console.log("Student summary built:", studentSummary.name, studentSummary.originCountry);

        // Call Gemini for matching
        const matches = await getAIMatches(studentSummary, targetUnis || []);
        console.log("AI matches result:", matches.success, matches.matches?.length);

        return new Response(
            JSON.stringify(matches),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Matcher Error:", error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

function buildStudentSummary(profile: any, preferences: any) {
    // Map regions to countries for smarter matching
    const regionCountryMap: Record<string, string[]> = {
        'north_america': ['USA', 'Canada'],
        'europe': ['UK', 'Germany', 'France', 'Netherlands', 'Switzerland', 'Ireland', 'Sweden'],
        'asia': ['Japan', 'South Korea', 'China', 'Singapore', 'Hong Kong'],
        'oceania': ['Australia', 'New Zealand'],
        'middle_east': ['UAE', 'Qatar', 'Saudi Arabia'],
    };

    // Get regions from profile.preferred_regions (saved by student in My Preferences)
    const studentRegions = profile.preferred_regions || preferences?.regions || [];

    // Get countries from regions if specified
    let targetCountries: string[] = preferences?.countries || [];
    if (studentRegions.length > 0) {
        studentRegions.forEach((region: string) => {
            if (regionCountryMap[region]) {
                targetCountries = [...targetCountries, ...regionCountryMap[region]];
            }
        });
    }
    // Default countries if none specified
    if (targetCountries.length === 0) {
        targetCountries = ['USA', 'UK', 'Canada', 'Australia'];
    }
    // Remove duplicates
    targetCountries = [...new Set(targetCountries)];

    return {
        name: profile.full_name || 'Unknown',
        // Student's origin country - important for international student status
        originCountry: profile.citizenship || profile.nationality || profile.country || 'Unknown',
        isInternational: true, // Assume international student
        currentEducation: profile.current_grade || profile.grade_level || 'High School',

        // GPA from profiles table - including individual year GPAs
        gpa: {
            cumulative: profile.gpa,
            scale: profile.gpa_scale || '4.0',
            grade9: profile.gpa_9th,
            grade10: profile.gpa_10th,
            grade11: profile.gpa_11th,
            grade12: profile.gpa_12th,
        },

        // Test scores from profiles table
        testScores: {
            sat: {
                total: profile.sat_total,
                math: profile.sat_math,
                reading: profile.sat_reading,
            },
            toefl: profile.toefl_total,
            ielts: {
                overall: profile.ielts_overall,
                listening: profile.ielts_listening,
                reading: profile.ielts_reading,
                writing: profile.ielts_writing,
                speaking: profile.ielts_speaking,
            },
        },

        // Preferences
        preferences: {
            targetCountries,
            regions: preferences?.regions || profile.preferred_regions || [],
            budget: profile.budget_level || preferences?.budget || 'Not specified',
            fieldOfStudy: preferences?.fieldOfStudy || profile.preferred_major || 'Undecided',
            degreeLevel: preferences?.degreeLevel || 'undergraduate',
            preferredUniversity: profile.preferred_university,
        }
    };
}

async function getAIMatches(studentSummary: any, existingTargets: any[]): Promise<MatcherResponse> {
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiKey) {
        return { success: false, error: "AI service not configured" };
    }

    const existingUniNames = existingTargets.map(u => u.university_name).join(", ");

    // Build comprehensive GPA string
    const gpaDetails = [];
    if (studentSummary.gpa.cumulative) gpaDetails.push(`Cumulative: ${studentSummary.gpa.cumulative}/${studentSummary.gpa.scale}`);
    if (studentSummary.gpa.grade9) gpaDetails.push(`9th: ${studentSummary.gpa.grade9}`);
    if (studentSummary.gpa.grade10) gpaDetails.push(`10th: ${studentSummary.gpa.grade10}`);
    if (studentSummary.gpa.grade11) gpaDetails.push(`11th: ${studentSummary.gpa.grade11}`);
    if (studentSummary.gpa.grade12) gpaDetails.push(`12th: ${studentSummary.gpa.grade12}`);
    const gpaString = gpaDetails.length > 0 ? gpaDetails.join(", ") : "Not provided";

    // Build SAT string
    const satString = studentSummary.testScores.sat.total
        ? `${studentSummary.testScores.sat.total} (Math: ${studentSummary.testScores.sat.math || 'N/A'}, Reading: ${studentSummary.testScores.sat.reading || 'N/A'})`
        : "Not taken";

    // Build IELTS string
    const ieltsString = studentSummary.testScores.ielts.overall
        ? `${studentSummary.testScores.ielts.overall} (L:${studentSummary.testScores.ielts.listening || 'N/A'} R:${studentSummary.testScores.ielts.reading || 'N/A'} W:${studentSummary.testScores.ielts.writing || 'N/A'} S:${studentSummary.testScores.ielts.speaking || 'N/A'})`
        : "Not taken";

    const prompt = `Role: You are the "Uniconsulting" Core Matching Engine. Your goal is to evaluate university eligibility with strict logical precision.

Task: Analyze the provided Student Profile and recommend the TOP 5 best-fit universities. You must apply STRICT LOGIC RULES for IELTS Sectional Scores and Budget constraints.

=== STRICT LOGIC RULES (MUST FOLLOW) ===

RULE 1 - IELTS BAND-SCORE CHECK:
Do NOT rely solely on the "Overall" score. You MUST compare the student's score in EACH DISTINCT SECTION against the university's minimum requirement for that section.

Logic: IF (Student_Listening < Uni_Min_Listening) OR (Student_Reading < Uni_Min_Reading) OR (Student_Writing < Uni_Min_Writing) OR (Student_Speaking < Uni_Min_Speaking) THEN REJECT.

Example: If a University requires 6.0 in all bands, and the student has 5.5 in Reading (even if their Overall is 7.0), you MUST mark this as NOT ELIGIBLE.

RULE 2 - SAT SECTIONAL CHECK:
Do NOT rely solely on the "Total" score. You MUST compare the student's score in EACH SECTION (Math and Reading/Writing) against the university's minimum requirement for that section.

Logic: IF (Student_SAT_Math < Uni_Min_Math) OR (Student_SAT_Reading < Uni_Min_Reading) THEN REJECT.

Example: If a University requires 650 in Math for Engineering programs, and the student has 580 Math (even if their Total is 1300), you MUST mark this as NOT ELIGIBLE for that program.

RULE 3 - FINANCIAL CONSTRAINT:
Compare the Student's Annual Budget against the University's Total Cost of Attendance (Tuition + Living Expenses).

Logic: IF (Student_Budget < Uni_Total_Cost) THEN REJECT (unless the university offers known full scholarships relevant to the student's profile).

=== STUDENT PROFILE ===

BACKGROUND:
- Name: ${studentSummary.name}
- Origin Country: ${studentSummary.originCountry}
- International Student: YES
- Current Education Level: ${studentSummary.currentEducation}

ACADEMIC PERFORMANCE:
- GPA: ${gpaString}
- GPA Scale: ${studentSummary.gpa.scale}

STANDARDIZED TEST SCORES:
- SAT Total: ${studentSummary.testScores.sat.total || "Not taken"}
- SAT Math: ${studentSummary.testScores.sat.math || "N/A"}
- SAT Reading: ${studentSummary.testScores.sat.reading || "N/A"}
- TOEFL Total: ${studentSummary.testScores.toefl || "Not taken"}

IELTS SCORES (IMPORTANT - CHECK EACH BAND):
- Overall: ${studentSummary.testScores.ielts.overall || "Not taken"}
- Listening: ${studentSummary.testScores.ielts.listening || "N/A"}
- Reading: ${studentSummary.testScores.ielts.reading || "N/A"}
- Writing: ${studentSummary.testScores.ielts.writing || "N/A"}
- Speaking: ${studentSummary.testScores.ielts.speaking || "N/A"}

BUDGET & PREFERENCES:
- Annual Budget: ${studentSummary.preferences.budget || "Not specified"} USD/year
- Target Countries: ${studentSummary.preferences.targetCountries.join(", ")}
- Field of Study: ${studentSummary.preferences.fieldOfStudy}
- Degree Level: ${studentSummary.preferences.degreeLevel}
${studentSummary.preferences.preferredUniversity ? `- Dream University: ${studentSummary.preferences.preferredUniversity}` : ''}

${existingUniNames ? `Already Considering: ${existingUniNames}` : ""}

=== MATCHING OUTPUT ===

For each university match, provide:
1. Whether they PASS or FAIL the IELTS sectional requirements (specify which bands)
2. Whether they PASS or FAIL the budget constraint
3. If they PASS both, include them in matches with detailed reasoning

Return ONLY valid JSON in this exact format:
{
  "matches": [
    {
      "name": "University Name",
      "country": "Country",
      "matchScore": 85,
      "reasons": [
        "IELTS: All bands meet requirements (requires 6.0 minimum, student has L:6.5 R:6.0 W:6.0 S:6.5)",
        "BUDGET: Total cost $25,000/year is within student budget",
        "Additional reason based on profile"
      ],
      "requirements": "IELTS 6.0 (no band below 5.5), GPA 3.0/4.0, SAT optional",
      "tuitionRange": "$XX,XXX - $XX,XXX per year"
    }
  ],
  "summary": "2-sentence personalized summary explaining the recommendations and any eligibility issues found"
}

CRITICAL: Only include universities where the student PASSES both IELTS sectional requirements AND budget constraints. Explain any rejections in the summary.`;


    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048,
                    responseMimeType: "application/json"
                }
            }),
        }
    );

    const result = await response.json();
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;

    try {
        const parsed = JSON.parse(content);
        return {
            success: true,
            matches: parsed.matches || [],
            summary: parsed.summary || ""
        };
    } catch {
        // Try to extract JSON from response
        const jsonMatch = content?.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                success: true,
                matches: parsed.matches || [],
                summary: parsed.summary || ""
            };
        }
        return { success: false, error: "Failed to parse AI response" };
    }
}
