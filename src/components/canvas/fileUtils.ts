/**
 * Compress an image file by drawing it to a canvas at reduced resolution.
 * Returns a data URL (JPEG for photos, PNG for transparent images).
 */
const MAX_IMAGE_DIMENSION = 2048;
const IMAGE_QUALITY = 0.92;
const MAX_NON_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB for non-image files

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Scale down if larger than max dimension
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Use JPEG for most images (smaller), PNG for transparency
      const isPng = file.type === 'image/png' || file.type === 'image/webp';
      const mimeType = isPng ? 'image/png' : 'image/jpeg';
      const dataUrl = canvas.toDataURL(mimeType, IMAGE_QUALITY);
      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to load image "${file.name}".`));
    };

    img.src = objectUrl;
  });
}

/**
 * Convert a File to a Base64 data URL for local-first storage.
 * Images are automatically compressed/resized for performance.
 * Non-image files are limited to 10MB.
 */
export function fileToDataUrl(file: File): Promise<string> {
  // For image files, compress via canvas (no size limit on input)
  if (file.type.startsWith('image/')) {
    return compressImage(file);
  }

  // For non-image files, enforce size limit
  return new Promise((resolve, reject) => {
    if (file.size > MAX_NON_IMAGE_SIZE) {
      reject(new Error(`File "${file.name}" exceeds the 10 MB limit.`));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as data URL.'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Programmatically open a file picker and return the selected file.
 * Returns null if the user cancels.
 */
export function pickFile(accept = '*'): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';

    input.addEventListener('change', () => {
      const file = input.files?.[0] ?? null;
      resolve(file);
      input.remove();
    });

    input.addEventListener('cancel', () => {
      resolve(null);
      input.remove();
    });

    document.body.appendChild(input);
    input.click();
  });
}
