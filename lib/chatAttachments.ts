import type { ChatAttachmentMeta } from './firebaseBackend';

export type PendingAttachment = ChatAttachmentMeta & {
  id: string;
  dataUrl: string;
};

export const MAX_ATTACHMENT_BYTES = 2_400_000;
export const MAX_ATTACHMENTS = 3;

export const SUPPORTED_ATTACHMENT_EXTENSIONS =
  /\.(pdf|txt|md|json|html?|xml|rtf|odt|docx?|pptx?|xlsx?|csv|tsv|iif|png|jpe?g|webp|gif|js|jsx|ts|tsx|py|java|c|cc|cpp|h|hpp|cs|go|rs|rb|php|swift|kt|kts|sh|sql|yaml|yml)$/i;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Could not read file.'));
    reader.onerror = () => reject(reader.error || new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

export function dataUrlByteSize(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return 0;
  const base64 = dataUrl.slice(comma + 1);
  return Math.floor((base64.length * 3) / 4);
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that photo.'));
    };
    image.src = url;
  });
}

export async function prepareImageAttachment(
  file: File,
  id: string
): Promise<PendingAttachment> {
  const image = await loadImageFromFile(file);
  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Photo processing is not available in this browser.');

  context.drawImage(image, 0, 0, width, height);

  let quality = 0.84;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrlByteSize(dataUrl) > 1_600_000 && quality > 0.5) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  const originalBase = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return {
    id,
    name: originalBase + '.jpg',
    type: 'image/jpeg',
    size: dataUrlByteSize(dataUrl),
    dataUrl,
  };
}

