/**
 * Camera capture helpers. Kept DOM-injectable so the widget core stays testable
 * without a real browser. A live `getUserMedia` preview is used when available;
 * a file input is always offered as a fallback (desktop / denied permission).
 */

/** Whether live camera capture is available in this environment. */
export function cameraSupported(nav: Navigator | undefined = globalThis.navigator): boolean {
  return !!nav?.mediaDevices?.getUserMedia;
}

/** Which camera to request: `environment` for documents, `user` for selfies. */
export type Facing = 'environment' | 'user';

/** Start a camera stream and bind it to a `<video>` element for preview. */
export async function startCamera(
  video: HTMLVideoElement,
  facing: Facing,
  nav: Navigator = globalThis.navigator,
): Promise<MediaStream> {
  const stream = await nav.mediaDevices.getUserMedia({
    video: { facingMode: facing },
    audio: false,
  });
  video.srcObject = stream;
  video.setAttribute('playsinline', 'true');
  video.muted = true;
  await video.play().catch(() => undefined);
  return stream;
}

/** Stop every track on a stream (releases the camera). */
export function stopCamera(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}

/** Grab the current video frame as a JPEG `Blob` via an offscreen canvas. */
export function grabFrame(
  video: HTMLVideoElement,
  doc: Document = globalThis.document,
  quality = 0.92,
): Promise<Blob> {
  const canvas = doc.createElement('canvas');
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas 2D context unavailable.'));
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to capture frame.'))),
      'image/jpeg',
      quality,
    );
  });
}

/** Read a selected file from an `<input type="file">` change event as a `Blob`. */
export function fileFromInput(input: HTMLInputElement): Blob | null {
  return input.files?.[0] ?? null;
}
