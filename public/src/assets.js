const TIMEOUT = 20000;

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error(label + " timeout")), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

// HTMLImageElement.decode()/onload can stall indefinitely while the tab is in
// the background (minimised window, another tab in front). fetch +
// createImageBitmap keeps working there, so it is the primary path.
async function decodeBitmap(url) {
  const response = await withTimeout(fetch(url), TIMEOUT, "Fetch");
  if (!response.ok) throw Error("HTTP " + response.status);
  const blob = await response.blob();
  return withTimeout(createImageBitmap(blob), TIMEOUT, "Bitmap decode");
}

// Fallback for formats createImageBitmap cannot read from a Blob (SVG in Chrome).
async function decodeElement(url) {
  const image = new Image();
  const loaded = new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(Error("Image load error"));
  });
  image.src = url;
  await withTimeout(loaded, TIMEOUT, "Image load");
  return image;
}

export class Assets {
  constructor() {
    this.cache = new Map();
    this.pending = new Map();
    this.failures = [];
  }
  get(picture) {
    return picture ? this.cache.get(picture.fileurl) : null;
  }
  async decode(url) {
    let lastError;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        let image;
        try {
          image = await decodeBitmap(url);
        } catch (error) {
          if (!url.endsWith(".svg")) throw error;
          image = await decodeElement(url);
        }
        const w = image.naturalWidth ?? image.width,
          h = image.naturalHeight ?? image.height;
        if (!w || !h) throw Error("Empty image");
        return image;
      } catch (error) {
        lastError = error;
        // Empty SVG exports have a companion PNG; retrying that SVG cannot help.
        if (url.endsWith(".svg")) break;
      }
    }
    throw lastError;
  }
  async load(picture) {
    if (this.cache.has(picture.fileurl)) return this.get(picture);
    if (this.pending.has(picture.fileurl))
      return this.pending.get(picture.fileurl);
    const task = (async () => {
      let image;
      const preferPng = picture.pngFallback !== false && picture.fileurl.endsWith(".svg");
      try {
        image = await this.decode(
          preferPng
            ? picture.fileurl.replace(/\.svg$/, ".png")
            : picture.fileurl,
        );
      } catch (error) {
        if (!preferPng) throw error;
        image = await this.decode(picture.fileurl);
      }
      const width = Math.max(1, Math.round(picture.dimension.width));
      const height = Math.max(1, Math.round(picture.dimension.height));
      const canvas =
        typeof OffscreenCanvas === "function"
          ? new OffscreenCanvas(width, height)
          : Object.assign(document.createElement("canvas"), { width, height });
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(image, 0, 0, width, height);
      const rgba = ctx.getImageData(0, 0, width, height).data;
      const alpha = new Uint8Array(width * height);
      for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
      canvas.width = canvas.height = 1;
      const record = { image, width, height, alpha };
      this.cache.set(picture.fileurl, record);
      return record;
    })();
    this.pending.set(picture.fileurl, task);
    try {
      return await task;
    } catch (error) {
      this.failures.push({ path: picture.fileurl, error: String(error) });
      throw Error(picture.fileurl + ": " + error);
    } finally {
      this.pending.delete(picture.fileurl);
    }
  }
  async preload(objects, onProgress = () => {}) {
    const pictures = [
      ...new Map(
        objects
          .flatMap((o) => o.sprite?.pictures || [])
          .map((p) => [p.fileurl, p]),
      ).values(),
    ];
    let next = 0,
      done = 0;
    // One broken picture must not stop the others: previously a rejection
    // silently killed its worker, and once all workers had died the progress
    // counter froze (e.g. "1052 / 1511") with no error shown.
    await Promise.all(
      Array.from({ length: 8 }, async () => {
        while (next < pictures.length) {
          const picture = pictures[next++];
          try {
            await this.load(picture);
          } catch (error) {
            console.warn("이미지 불러오기 실패", error);
          }
          onProgress(++done, pictures.length, this.failures.length);
        }
      }),
    );
    return this.failures;
  }
}
