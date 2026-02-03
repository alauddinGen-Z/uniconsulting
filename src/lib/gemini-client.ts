/**
 * Gemini API Wrapper with Retry Logic & Rate Limiting
 * 
 * Provides a robust wrapper around Google Gemini API calls with:
 * - Exponential backoff retry logic
 * - Configurable timeouts
 * - Clean error handling
 * - Request logging
 * 
 * @file src/lib/gemini-client.ts
 */

// Retry configuration
interface RetryConfig {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    timeoutMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 1000,  // 1 second
    maxDelayMs: 8000,      // 8 seconds max
    timeoutMs: 60000,      // 60 second timeout
};

// Error types for better error handling
export class GeminiAPIError extends Error {
    constructor(
        message: string,
        public statusCode: number,
        public retryable: boolean,
        public originalError?: Error
    ) {
        super(message);
        this.name = 'GeminiAPIError';
    }
}

export class GeminiTimeoutError extends GeminiAPIError {
    constructor(timeoutMs: number) {
        super(
            `Request timed out after ${timeoutMs}ms. Please try again.`,
            408,
            true
        );
        this.name = 'GeminiTimeoutError';
    }
}

export class GeminiRateLimitError extends GeminiAPIError {
    constructor() {
        super(
            'AI service is temporarily busy. Please wait a moment and try again.',
            429,
            true
        );
        this.name = 'GeminiRateLimitError';
    }
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 * @param attempt - Current attempt number (0-indexed)
 * @param initialDelay - Initial delay in milliseconds
 * @param maxDelay - Maximum delay cap
 */
function getBackoffDelay(attempt: number, initialDelay: number, maxDelay: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s...
    const delay = initialDelay * Math.pow(2, attempt);
    // Add jitter (±10%) to prevent thundering herd
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    return Math.min(delay + jitter, maxDelay);
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(status: number): boolean {
    // Retry on: 408 (Timeout), 429 (Rate Limit), 500+ (Server Errors)
    return status === 408 || status === 429 || status >= 500;
}

/**
 * Create a user-friendly error message based on status code
 */
function getUserFriendlyErrorMessage(status: number, originalMessage?: string): string {
    switch (status) {
        case 400:
            return 'Invalid request. Please check your input and try again.';
        case 401:
        case 403:
            return 'AI service authentication failed. Please contact support.';
        case 404:
            return 'AI service endpoint not found. Please contact support.';
        case 408:
            return 'Request timed out. Please try again with a smaller document.';
        case 429:
            return 'AI service is temporarily busy. Please wait a moment and try again.';
        case 500:
        case 502:
        case 503:
        case 504:
            return 'AI service is temporarily unavailable. Please try again in a few moments.';
        default:
            return originalMessage || 'An unexpected error occurred. Please try again.';
    }
}

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number
): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        return response;
    } catch (error: any) {
        if (error.name === 'AbortError') {
            throw new GeminiTimeoutError(timeoutMs);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Gemini API request configuration
 */
export interface GeminiRequest {
    contents: Array<{
        parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }>;
    }>;
    generationConfig?: {
        temperature?: number;
        maxOutputTokens?: number;
        responseMimeType?: string;
        responseSchema?: Record<string, unknown>; // JSON Schema for structured output
    };
}

/**
 * Gemini API response structure
 */
export interface GeminiResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{ text?: string }>;
        };
    }>;
    error?: {
        message: string;
        code: number;
    };
}

/**
 * Main Gemini API wrapper with retry logic
 * 
 * @param apiKey - Gemini API key
 * @param request - The request payload
 * @param config - Optional retry configuration
 * @returns The API response text
 * 
 * @example
 * try {
 *   const response = await callGeminiWithRetry(
 *     process.env.GEMINI_API_KEY!,
 *     {
 *       contents: [{ parts: [{ text: 'Hello, world!' }] }],
 *       generationConfig: { temperature: 0.7 }
 *     }
 *   );
 *   console.log(response);
 * } catch (error) {
 *   if (error instanceof GeminiAPIError) {
 *     console.error('API Error:', error.message);
 *   }
 * }
 */
export async function callGeminiWithRetry(
    apiKey: string,
    request: GeminiRequest,
    config: Partial<RetryConfig> = {}
): Promise<string> {
    const { maxRetries, initialDelayMs, maxDelayMs, timeoutMs } = {
        ...DEFAULT_RETRY_CONFIG,
        ...config,
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // Log attempt
            if (attempt > 0) {
                console.log(`[Gemini] Retry attempt ${attempt}/${maxRetries}...`);
            }

            // Make the request with timeout
            const response = await fetchWithTimeout(
                url,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(request),
                },
                timeoutMs
            );

            // Handle non-OK responses
            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');

                // Check if retryable
                if (isRetryableError(response.status) && attempt < maxRetries) {
                    const delay = getBackoffDelay(attempt, initialDelayMs, maxDelayMs);
                    console.log(`[Gemini] Request failed with ${response.status}. Retrying in ${delay}ms...`);
                    await sleep(delay);
                    continue;
                }

                // Non-retryable or max retries exceeded
                throw new GeminiAPIError(
                    getUserFriendlyErrorMessage(response.status, errorText),
                    response.status,
                    false
                );
            }

            // Parse successful response
            const result: GeminiResponse = await response.json();

            // DEBUG: Log full response structure
            console.log('[Gemini] Response candidates count:', result.candidates?.length);
            console.log('[Gemini] First candidate finishReason:', (result as any).candidates?.[0]?.finishReason);
            console.log('[Gemini] First candidate parts count:', result.candidates?.[0]?.content?.parts?.length);
            console.log('[Gemini] Full candidates structure:', JSON.stringify(result.candidates, null, 2).substring(0, 1500));

            // Check for API-level errors
            if (result.error) {
                throw new GeminiAPIError(
                    result.error.message || 'Unknown API error',
                    result.error.code || 500,
                    false
                );
            }

            // Extract text from response - concatenate ALL parts (Gemini may split long responses)
            const parts = result.candidates?.[0]?.content?.parts || [];
            const text = parts
                .map(part => part.text || '')
                .join('');

            if (!text) {
                throw new GeminiAPIError(
                    'AI returned an empty response. Please try again.',
                    500,
                    true
                );
            }

            console.log(`[Gemini] Request successful (attempt ${attempt + 1}), response length: ${text.length}`);
            return text;

        } catch (error: any) {
            lastError = error;

            // If it's a timeout or retryable error, retry
            if (error instanceof GeminiTimeoutError && attempt < maxRetries) {
                const delay = getBackoffDelay(attempt, initialDelayMs, maxDelayMs);
                console.log(`[Gemini] Timeout. Retrying in ${delay}ms...`);
                await sleep(delay);
                continue;
            }

            // If it's a network error, retry
            if (error.name === 'TypeError' && error.message.includes('fetch') && attempt < maxRetries) {
                const delay = getBackoffDelay(attempt, initialDelayMs, maxDelayMs);
                console.log(`[Gemini] Network error. Retrying in ${delay}ms...`);
                await sleep(delay);
                continue;
            }

            // If it's already a GeminiAPIError, rethrow
            if (error instanceof GeminiAPIError) {
                throw error;
            }

            // Unknown error on last attempt
            if (attempt === maxRetries) {
                throw new GeminiAPIError(
                    'Failed to connect to AI service after multiple attempts. Please try again later.',
                    500,
                    false,
                    error
                );
            }
        }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new GeminiAPIError('Unknown error', 500, false);
}

/**
 * Convenience function for text-only prompts
 */
export async function generateText(
    apiKey: string,
    prompt: string,
    options: {
        temperature?: number;
        maxTokens?: number;
        retryConfig?: Partial<RetryConfig>;
    } = {}
): Promise<string> {
    return callGeminiWithRetry(
        apiKey,
        {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: options.temperature ?? 0.7,
                maxOutputTokens: options.maxTokens ?? 2048,
            },
        },
        options.retryConfig
    );
}

/**
 * Convenience function for vision/image prompts
 */
export async function analyzeImage(
    apiKey: string,
    prompt: string,
    imageBase64: string,
    mimeType: string,
    options: {
        temperature?: number;
        maxTokens?: number;
        retryConfig?: Partial<RetryConfig>;
    } = {}
): Promise<string> {
    return callGeminiWithRetry(
        apiKey,
        {
            contents: [{
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: mimeType, data: imageBase64 } }
                ]
            }],
            generationConfig: {
                temperature: options.temperature ?? 0.1,
                maxOutputTokens: options.maxTokens ?? 2048,
            },
        },
        options.retryConfig
    );
}
