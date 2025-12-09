/**
 * Image compression utility for faster OCR processing
 * Reduces image size while maintaining readable quality
 */

export interface CompressedImage {
    base64: string;
    mimeType: string;
    originalSize: number;
    compressedSize: number;
}

/**
 * Compress an image file for faster OCR processing
 * Resizes large images and compresses to JPEG
 * 
 * @param file - The image file to compress
 * @param maxWidth - Maximum width (default: 1200px - enough for OCR)
 * @param quality - JPEG quality (default: 0.7 - good balance)
 */
export async function compressImageForOCR(
    file: File,
    maxWidth: number = 1200,
    quality: number = 0.7
): Promise<CompressedImage> {
    return new Promise((resolve, reject) => {
        const originalSize = file.size;

        // If file is already small enough, just convert to base64
        if (file.size < 100 * 1024) { // Less than 100KB
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                const mimeType = result.split(';')[0].split(':')[1] || 'image/jpeg';
                const base64 = result.split(',')[1];
                resolve({
                    base64,
                    mimeType,
                    originalSize,
                    compressedSize: base64.length
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
            return;
        }

        // Create image element
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            // Calculate new dimensions
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }

            // Create canvas and draw resized image
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }

            // Use smooth scaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to base64 JPEG
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            const base64 = dataUrl.split(',')[1];

            console.log(`Image compressed: ${Math.round(originalSize / 1024)}KB → ${Math.round(base64.length / 1024)}KB (${Math.round((1 - base64.length / originalSize) * 100)}% smaller)`);

            resolve({
                base64,
                mimeType: 'image/jpeg',
                originalSize,
                compressedSize: base64.length
            });
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            // Fallback to original file if image loading fails (e.g., PDF)
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                const mimeType = result.split(';')[0].split(':')[1] || 'application/octet-stream';
                const base64 = result.split(',')[1];
                resolve({
                    base64,
                    mimeType,
                    originalSize,
                    compressedSize: base64.length
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        };

        img.src = url;
    });
}
