/**
 * Convert a File to a Base64 data URL for local-first storage.
 * Limits file size to 5MB to keep the vault JSON manageable.
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_SIZE) {
      reject(new Error(`File "${file.name}" exceeds the 5 MB limit.`));
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
