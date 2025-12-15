/**
 * Automation Service Bridge
 * 
 * TypeScript client for communicating with the Python automation service
 * running on port 8765.
 * 
 * @file desktop-app/src/src/lib/automation.ts
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const API_URL = 'http://127.0.0.1:8765';
const CONNECTION_TIMEOUT_MS = 5000;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// =============================================================================
// TYPES
// =============================================================================

export interface TaskStartResponse {
    status: string;
    task_description: string;
    task_id: string;
}

export interface TaskStatusResponse {
    task_id: string;
    status: string;
    progress: number;
    message: string;
    timestamp: string;
    account_created?: {
        email: string;
        password: string;
        university: string;
    } | null;
}

export interface ApplicationRequest {
    student_id: string;
    student_data: Record<string, unknown>;
    university_name: string;
    mode: 'semi' | 'full';
    gemini_api_key?: string;
}

export interface ApplicationStartResponse {
    task_id: string;
    status: string;
}

export interface HealthResponse {
    status: string;
    timestamp: string;
    gemini_configured: boolean;
}

export interface AutomationError {
    type: 'CONNECTION_FAILED' | 'SERVER_ERROR' | 'TIMEOUT' | 'UNKNOWN';
    message: string;
    details?: unknown;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Wait for the specified duration
 */
const delay = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

/**
 * Create a fetch request with timeout
 */
async function fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeout: number = CONNECTION_TIMEOUT_MS
): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        return response;
    } finally {
        clearTimeout(timeoutId);
    }
}

// =============================================================================
// SERVICE STATUS
// =============================================================================

/**
 * Check if the automation service is running and healthy
 * 
 * @returns True if service is available
 */
export async function isServiceRunning(): Promise<boolean> {
    try {
        const response = await fetchWithTimeout(`${API_URL}/health`, {}, 2000);
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Wait for the automation service to become available
 * Useful after app startup to ensure Python has booted
 * 
 * @param maxWaitMs Maximum time to wait (default: 10 seconds)
 * @returns True if service became available
 */
export async function waitForService(maxWaitMs: number = 10000): Promise<boolean> {
    const startTime = Date.now();
    const pollInterval = 500;

    console.log('[Automation] Waiting for service to become available...');

    while (Date.now() - startTime < maxWaitMs) {
        if (await isServiceRunning()) {
            console.log('[Automation] Service is ready!');
            return true;
        }
        await delay(pollInterval);
    }

    console.warn('[Automation] Service did not become available within timeout');
    return false;
}

/**
 * Get detailed health status of the automation service
 */
export async function getServiceHealth(): Promise<HealthResponse | null> {
    try {
        const response = await fetchWithTimeout(`${API_URL}/health`);
        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch {
        return null;
    }
}

// =============================================================================
// TASK EXECUTION (Simple /run-task endpoint)
// =============================================================================

/**
 * Start an automation task (non-blocking)
 * 
 * This sends a task to the Python server which executes in the background.
 * Returns immediately with a task ID for tracking.
 * 
 * @param task Task description for the automation agent
 * @returns Task start response with task_id
 * @throws AutomationError if connection fails
 */
export async function startAutomation(task: string): Promise<TaskStartResponse> {
    console.log('[Automation] Starting task:', task.substring(0, 100) + '...');

    // Retry logic for connection errors (server might still be starting)
    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
        try {
            const response = await fetchWithTimeout(
                `${API_URL}/run-task`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ task }),
                },
                CONNECTION_TIMEOUT_MS
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw {
                    type: 'SERVER_ERROR',
                    message: `Server error: ${response.status}`,
                    details: errorText,
                } as AutomationError;
            }

            const result = await response.json();
            console.log('[Automation] Task started:', result.task_id);
            return result as TaskStartResponse;

        } catch (error: unknown) {
            // Check if it's an abort error (timeout)
            if (error instanceof Error && error.name === 'AbortError') {
                if (attempt < MAX_RETRY_ATTEMPTS) {
                    console.log(`[Automation] Timeout, retrying (${attempt}/${MAX_RETRY_ATTEMPTS})...`);
                    await delay(RETRY_DELAY_MS);
                    continue;
                }
                throw {
                    type: 'TIMEOUT',
                    message: 'Connection timed out after multiple attempts',
                } as AutomationError;
            }

            // Check if it's a network error (server not running)
            if (error instanceof TypeError && error.message.includes('fetch')) {
                if (attempt < MAX_RETRY_ATTEMPTS) {
                    console.log(`[Automation] Connection failed, retrying (${attempt}/${MAX_RETRY_ATTEMPTS})...`);
                    await delay(RETRY_DELAY_MS);
                    continue;
                }
                throw {
                    type: 'CONNECTION_FAILED',
                    message: 'Could not connect to automation service. Is the Python server running?',
                } as AutomationError;
            }

            // Re-throw if it's already an AutomationError
            if ((error as AutomationError).type) {
                throw error;
            }

            // Unknown error
            throw {
                type: 'UNKNOWN',
                message: error instanceof Error ? error.message : 'Unknown error',
                details: error,
            } as AutomationError;
        }
    }

    // Should never reach here, but TypeScript needs this
    throw {
        type: 'UNKNOWN',
        message: 'Unexpected error in retry loop',
    } as AutomationError;
}

// =============================================================================
// UNIVERSITY APPLICATION (Full /api/apply endpoint)
// =============================================================================

/**
 * Start a university application automation
 * 
 * @param request Application details including student data and target university
 * @returns Application start response with task_id
 */
export async function startUniversityApplication(
    request: ApplicationRequest
): Promise<ApplicationStartResponse> {
    console.log('[Automation] Starting university application:', request.university_name);

    try {
        const response = await fetchWithTimeout(
            `${API_URL}/api/apply`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request),
            },
            CONNECTION_TIMEOUT_MS
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw {
                type: 'SERVER_ERROR',
                message: `Server error: ${response.status}`,
                details: errorText,
            } as AutomationError;
        }

        return await response.json();

    } catch (error: unknown) {
        if ((error as AutomationError).type) {
            throw error;
        }

        throw {
            type: 'CONNECTION_FAILED',
            message: 'Could not connect to automation service',
            details: error,
        } as AutomationError;
    }
}

/**
 * Get status of an automation task
 * 
 * @param taskId The task ID returned from startAutomation or startUniversityApplication
 * @returns Current task status
 */
export async function getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
    const response = await fetchWithTimeout(`${API_URL}/api/status/${taskId}`);

    if (!response.ok) {
        if (response.status === 404) {
            throw {
                type: 'UNKNOWN',
                message: 'Task not found',
            } as AutomationError;
        }
        throw {
            type: 'SERVER_ERROR',
            message: `Server error: ${response.status}`,
        } as AutomationError;
    }

    return await response.json();
}

/**
 * Confirm or cancel a semi-auto application submission
 * 
 * @param taskId The task ID
 * @param action 'submit' to proceed or 'cancel' to abort
 */
export async function confirmSubmission(
    taskId: string,
    action: 'submit' | 'cancel'
): Promise<void> {
    const response = await fetchWithTimeout(
        `${API_URL}/api/confirm/${taskId}?action=${action}`,
        { method: 'POST' }
    );

    if (!response.ok) {
        throw {
            type: 'SERVER_ERROR',
            message: `Server error: ${response.status}`,
        } as AutomationError;
    }
}

// =============================================================================
// WEBSOCKET CONNECTION (Real-time progress)
// =============================================================================

/**
 * Connect to WebSocket for real-time task updates
 * 
 * @param taskId The task ID to monitor
 * @param onUpdate Callback for status updates
 * @param onError Callback for errors
 * @returns Cleanup function to close connection
 */
export function connectToTaskUpdates(
    taskId: string,
    onUpdate: (status: TaskStatusResponse) => void,
    onError?: (error: Error) => void
): () => void {
    const wsUrl = `ws://127.0.0.1:8765/ws/progress/${taskId}`;
    console.log('[Automation] Connecting to WebSocket:', wsUrl);

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('[Automation] WebSocket connected');
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            onUpdate(data);
        } catch (e) {
            console.error('[Automation] Failed to parse WebSocket message:', e);
        }
    };

    ws.onerror = (event) => {
        console.error('[Automation] WebSocket error:', event);
        if (onError) {
            onError(new Error('WebSocket connection error'));
        }
    };

    ws.onclose = () => {
        console.log('[Automation] WebSocket closed');
    };

    // Return cleanup function
    return () => {
        ws.close();
    };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    startAutomation,
    startUniversityApplication,
    getTaskStatus,
    confirmSubmission,
    isServiceRunning,
    waitForService,
    getServiceHealth,
    connectToTaskUpdates,
    API_URL,
};
