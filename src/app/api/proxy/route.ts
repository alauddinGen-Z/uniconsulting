import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url');

    if (!url) {
        return new NextResponse('Missing URL parameter', { status: 400 });
    }

    try {
        const targetUrl = new URL(url);

        // Fetch the target URL
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
        });

        const contentType = response.headers.get('content-type');
        const text = await response.text();

        // If it's HTML, inject <base> tag to fix relative links
        let modifiedText = text;
        if (contentType?.includes('text/html')) {
            const baseTag = `<base href="${targetUrl.origin}${targetUrl.pathname}" />`;
            // Try to insert after <head>, fallback to beginning if no head
            if (modifiedText.includes('<head>')) {
                modifiedText = modifiedText.replace('<head>', `<head>${baseTag}`);
            } else {
                modifiedText = `${baseTag}${modifiedText}`;
            }
        }

        // Return response with security headers stripped/relaxed
        return new NextResponse(modifiedText, {
            status: response.status,
            headers: {
                'Content-Type': contentType || 'text/html',
                'X-Frame-Options': 'ALLOWALL', // Override
                'Content-Security-Policy': '', // Clear CSP
                'Access-Control-Allow-Origin': '*',
            },
        });

    } catch (error: any) {
        return new NextResponse(`Error fetching URL: ${error.message}`, { status: 500 });
    }
}
