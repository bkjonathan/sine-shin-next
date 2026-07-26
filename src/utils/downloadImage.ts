/**
 * iOS Safari/WebKit silently fails to download `data:` URIs via `<a download>`
 * once the payload gets reasonably large (no error, the tap just does nothing).
 * Converting to a `blob:` URL first is the reliable cross-platform fix.
 */
export async function downloadDataUrl(dataUrl: string, filename: string): Promise<void> {
  const blob = await (await fetch(dataUrl)).blob();
  const blobUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.download = filename;
    link.href = blobUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }
}
