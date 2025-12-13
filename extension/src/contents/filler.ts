/**
 * Content Script: Form Filler
 * 
 * Runs on every page to:
 * - Scan for form elements
 * - Fill form fields with mapped data
 * 
 * @file extension/src/contents/filler.ts
 */

import type { PlasmoCSConfig } from 'plasmo'
import type { FieldMapping, FormElement } from '../lib/types'

export const config: PlasmoCSConfig = {
    matches: ['<all_urls>'],
    run_at: 'document_idle',
}

/**
 * Scan the page for form elements
 */
function scanPage(): FormElement[] {
    const elements: FormElement[] = []

    // Find all input, select, and textarea elements
    const formElements = document.querySelectorAll('input, select, textarea')

    formElements.forEach((element, index) => {
        const el = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

        // Skip hidden, submit, button, and file inputs
        if (el.tagName === 'INPUT') {
            const inputType = (el as HTMLInputElement).type.toLowerCase()
            if (['hidden', 'submit', 'button', 'reset', 'file', 'image'].includes(inputType)) {
                return
            }
        }

        // Try to find the associated label
        let labelText = ''

        // Check for explicit label via 'for' attribute
        if (el.id) {
            const label = document.querySelector(`label[for="${el.id}"]`)
            if (label) {
                labelText = label.textContent?.trim() || ''
            }
        }

        // Check for parent label
        if (!labelText) {
            const parentLabel = el.closest('label')
            if (parentLabel) {
                // Get text content excluding the input element itself
                const clone = parentLabel.cloneNode(true) as HTMLElement
                clone.querySelectorAll('input, select, textarea').forEach(input => input.remove())
                labelText = clone.textContent?.trim() || ''
            }
        }

        // Check for aria-labelledby
        if (!labelText && el.getAttribute('aria-labelledby')) {
            const labelledBy = document.getElementById(el.getAttribute('aria-labelledby')!)
            if (labelledBy) {
                labelText = labelledBy.textContent?.trim() || ''
            }
        }

        // Generate a unique selector
        let selector = ''
        if (el.id) {
            selector = `#${el.id}`
        } else if (el.name) {
            selector = `[name="${el.name}"]`
        } else {
            // Use data attribute as fallback
            const uniqueId = `admitai-${index}`
            el.setAttribute('data-admitai-id', uniqueId)
            selector = `[data-admitai-id="${uniqueId}"]`
        }

        elements.push({
            selector,
            tagName: el.tagName,
            type: el.tagName === 'INPUT' ? (el as HTMLInputElement).type : undefined,
            id: el.id || undefined,
            name: el.name || undefined,
            placeholder: el.placeholder || undefined,
            label: labelText || undefined,
            ariaLabel: el.getAttribute('aria-label') || undefined,
            value: el.value || undefined,
        })
    })

    console.log(`[Filler] Scanned ${elements.length} form elements`)
    return elements
}

/**
 * Fill the page with mapped values
 */
function fillPage(mapping: FieldMapping[]): { success: boolean; filled: number } {
    let filledCount = 0

    mapping.forEach(({ selector, value }) => {
        try {
            const element = document.querySelector(selector) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

            if (!element) {
                console.warn(`[Filler] Element not found: ${selector}`)
                return
            }

            // Set the value
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype :
                    element.tagName === 'SELECT' ? window.HTMLSelectElement.prototype :
                        window.HTMLInputElement.prototype,
                'value'
            )?.set

            if (nativeInputValueSetter) {
                nativeInputValueSetter.call(element, value)
            } else {
                element.value = value
            }

            // Dispatch events for React/Vue/Angular form libraries
            element.dispatchEvent(new Event('input', { bubbles: true }))
            element.dispatchEvent(new Event('change', { bubbles: true }))
            element.dispatchEvent(new Event('blur', { bubbles: true }))

            // For React's synthetic events
            const reactEvent = new Event('input', { bubbles: true })
            Object.defineProperty(reactEvent, 'target', { writable: false, value: element })
            element.dispatchEvent(reactEvent)

            filledCount++
            console.log(`[Filler] Filled ${selector} with "${value.substring(0, 20)}..."`)
        } catch (error) {
            console.error(`[Filler] Error filling ${selector}:`, error)
        }
    })

    console.log(`[Filler] Successfully filled ${filledCount}/${mapping.length} fields`)
    return { success: true, filled: filledCount }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Filler] Message received:', message.type)

    switch (message.type) {
        case 'SCAN_PAGE':
            const elements = scanPage()
            sendResponse({ success: true, elements })
            break

        case 'FILL_PAGE':
            const result = fillPage(message.mapping)
            sendResponse(result)
            break

        default:
            sendResponse({ error: 'Unknown message type' })
    }

    return true
})

// Indicate that the content script is ready
console.log('[Filler] AdmitAI content script loaded on:', window.location.href)
