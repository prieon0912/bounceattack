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
      const image = new Image();
      image.src = url;
      let timer;
      try {
        await Promise.race([
          image.decode(),
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject(Error("Image decode timeout")),
              60000,
            );
          }),
        ]);
        if (!image.naturalWidth || !image.naturalHeight)
          throw Error("Empty image");
        return image;
      } catch (error) {
        lastError = error;
        // Empty SVG exports have a companion PNG; retrying that SVG cannot help.
        if (url.endsWith(".svg")) break;
      } finally {
        clearTimeout(timer);
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
      try {
        image = await this.decode(picture.fileurl.endsWith(".svg") ? picture.fileurl.replace(/\.svg$/, ".png") : picture.fileurl);
      } catch (error) {
        if (!picture.fileurl.endsWith(".svg")) throw error;
        image = await this.decode(picture.fileurl);
      }
      const width = Math.max(1, Math.round(picture.dimension.width));
      const height = Math.max(1, Math.round(picture.dimension.height));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
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
    // Bound decode concurrency: two players may load the entire original atlas at once.
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (next < pictures.length) {
          await this.load(pictures[next++]);
          onProgress(++done, pictures.length);
        }
      }),
    );
  }
}
