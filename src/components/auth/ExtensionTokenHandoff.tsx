/**
 * Extension Token Handoff Component
 * 
 * This component detects if the user came from the AdmitAI Agent extension
 * and sends the Supabase session to the extension after successful login.
 * 
 * @file src/components/auth/ExtensionTokenHandoff.tsx
 */

"use client";

import { useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useSearchParams } from "next/navigation";

// Chrome extension API types (only used at runtime when extension is installed)
declare global {
    interface Window {
        chrome?: {
            runtime?: {
                sendMessage: (
                    extensionId: string,
                    message: unknown,
                    callback: (response: { success?: boolean; error?: string }) => void
                ) => void;
                lastError?: { message: string };
            };
        };
    }
}
const chrome = typeof window !== "undefined" ? window.chrome : undefined;

export default function ExtensionTokenHandoff() {
    const searchParams = useSearchParams();

    useEffect(() => {
        const extensionId = searchParams.get("ext");

        if (!extensionId) {
            return; // Not coming from extension
        }

        console.log("[TokenHandoff] Extension ID detected:", extensionId);

        // Set up auth state listener
        const supabase = createClient();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (event === "SIGNED_IN" && session) {
                    console.log("[TokenHandoff] User signed in, sending session to extension");

                    try {
                        // Send session to extension
                        const response = await new Promise((resolve, reject) => {
                            const timeout = setTimeout(() => {
                                reject(new Error("Extension not responding"));
                            }, 5000);

                            // Check if chrome.runtime is available (we're in a browser with the extension)
                            if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
                                chrome.runtime.sendMessage(
                                    extensionId,
                                    {
                                        type: "SESSION_HANDOFF",
                                        session: {
                                            access_token: session.access_token,
                                            refresh_token: session.refresh_token,
                                        },
                                    },
                                    (response) => {
                                        clearTimeout(timeout);
                                        if (chrome?.runtime?.lastError) {
                                            reject(new Error(chrome.runtime.lastError.message));
                                        } else {
                                            resolve(response);
                                        }
                                    }
                                );
                            } else {
                                clearTimeout(timeout);
                                console.log("[TokenHandoff] Chrome runtime not available");
                                resolve(null);
                            }
                        });

                        if (response && (response as any).success) {
                            console.log("[TokenHandoff] Session sent to extension successfully");

                            // Show a brief success message
                            const notification = document.createElement("div");
                            notification.innerHTML = `
                <div style="
                  position: fixed;
                  bottom: 20px;
                  right: 20px;
                  background: linear-gradient(135deg, #22c55e, #16a34a);
                  color: white;
                  padding: 16px 24px;
                  border-radius: 12px;
                  font-family: system-ui, sans-serif;
                  font-weight: 600;
                  box-shadow: 0 8px 32px rgba(34, 197, 94, 0.3);
                  z-index: 9999;
                  animation: slideIn 0.3s ease-out;
                ">
                  ✅ Connected to AdmitAI Agent Extension!
                </div>
                <style>
                  @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                  }
                </style>
              `;
                            document.body.appendChild(notification);

                            // Remove after 3 seconds
                            setTimeout(() => {
                                notification.remove();
                            }, 3000);
                        }
                    } catch (error) {
                        console.warn("[TokenHandoff] Failed to send session to extension:", error);
                        // This is not critical - the extension can still use manual login
                    }
                }
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [searchParams]);

    // This component doesn't render anything
    return null;
}
