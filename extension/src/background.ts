/**
 * Background Service Worker for AdmitAI Agent
 * 
 * Handles:
 * - Token Handoff from web app
 * - Message passing between popup and content scripts
 * - API coordination
 * 
 * @file extension/src/background.ts
 */

import { receiveSessionFromWebApp, getSession, getCurrentUser, signOut } from './lib/supabase'

// Listen for messages from the web app (Token Handoff)
chrome.runtime.onMessageExternal.addListener(
    async (message, sender, sendResponse) => {
        console.log('[Background] External message received:', message.type, 'from:', sender.origin)

        if (message.type === 'SESSION_HANDOFF') {
            // Verify the sender is from an allowed origin
            const allowedOrigins = [
                'http://localhost:3000',
                'https://uniconsulting.vercel.app',
                'https://uniconsulting.netlify.app',
            ]

            // Also allow any *.vercel.app or *.netlify.app
            const isAllowed = allowedOrigins.some(origin => sender.origin?.startsWith(origin.replace('*', ''))) ||
                sender.origin?.endsWith('.vercel.app') ||
                sender.origin?.endsWith('.netlify.app')

            if (!isAllowed) {
                console.warn('[Background] Rejected session handoff from:', sender.origin)
                sendResponse({ success: false, error: 'Origin not allowed' })
                return true
            }

            try {
                const success = await receiveSessionFromWebApp(message.session)
                sendResponse({ success })

                if (success) {
                    // Notify all open popups that auth state changed
                    chrome.runtime.sendMessage({ type: 'AUTH_STATE_CHANGED' }).catch(() => { })
                }
            } catch (error) {
                console.error('[Background] Session handoff failed:', error)
                sendResponse({ success: false, error: String(error) })
            }
            return true
        }

        return false
    }
)

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Background] Internal message received:', message.type)

    handleMessage(message, sender).then(sendResponse).catch(error => {
        console.error('[Background] Message handling error:', error)
        sendResponse({ error: String(error) })
    })

    return true // Keep the message channel open for async response
})

async function handleMessage(message: any, sender: chrome.runtime.MessageSender) {
    switch (message.type) {
        case 'GET_AUTH_STATUS': {
            const user = await getCurrentUser()
            const session = await getSession()
            return {
                authenticated: !!user,
                user: user ? { id: user.id, email: user.email } : null,
                hasSession: !!session
            }
        }

        case 'SIGN_OUT': {
            await signOut()
            return { success: true }
        }

        case 'SCAN_PAGE': {
            // Forward to the active tab's content script
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
            if (!tab?.id) {
                throw new Error('No active tab')
            }

            return new Promise((resolve, reject) => {
                chrome.tabs.sendMessage(tab.id!, { type: 'SCAN_PAGE' }, response => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message))
                    } else {
                        resolve(response)
                    }
                })
            })
        }

        case 'FILL_PAGE': {
            // Forward to the active tab's content script
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
            if (!tab?.id) {
                throw new Error('No active tab')
            }

            return new Promise((resolve, reject) => {
                chrome.tabs.sendMessage(tab.id!, { type: 'FILL_PAGE', mapping: message.mapping }, response => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message))
                    } else {
                        resolve(response)
                    }
                })
            })
        }

        default:
            console.warn('[Background] Unknown message type:', message.type)
            return { error: 'Unknown message type' }
    }
}

// Log when the service worker starts
console.log('[Background] AdmitAI Agent service worker started')

export { }
