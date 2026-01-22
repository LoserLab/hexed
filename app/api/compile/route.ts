import sharp from "sharp";
import { NextResponse } from "next/server";

const MAX_IMAGES = 5;
const MAX_DIM = 768;

// Best default for this kind of “upload images, extract palette” endpoint.
// Big enough for normal PNG/JPG/WebP exports, small enough to avoid memory abuse.
const MAX_BYTES_PER_IMAGE = 10 * 1024 * 1024; // 10MB

function clampByte(n: number) {
  return Math.max(0, Math.min(255, n));
}

function rgbToHex(r: number, g: number, b: number) {
  const rr = clampByte(r).toString(16).padStart(2, "0");
  const gg = clampByte(g).toString(16).padStart(2, "0");
  const bb = clampByte(b).toString(16).padStart(2, "0");
  return `#${rr}${gg}${bb}`.toUpperCase();
}

function dist2(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number }
) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

export async function POST(req: Request) {
  const form = await req.formData();

  const mode = (form.get("mode")?.toString() || "ui_first") as
    | "ui_first"
    | "brand_first";

  const images = form
    .getAll("images")
    .filter((v): v is File => v instanceof File);

  if (images.length === 0) {
    // Backward-compatible single upload
    const single = form.get("image");
    if (single instanceof File) images.push(single);
  }

  if (images.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "missing_images",
        message:
          "Upload 1–5 files under form field name 'images' (or 'image' for single).",
      },
      { status: 400 }
    );
  }

  if (images.length > MAX_IMAGES) {
    return NextResponse.json(
      { ok: false, error: "too_many_images", message: `Max ${MAX_IMAGES} images.` },
      { status: 400 }
    );
  }

  // File size guard (prevents memory exhaustion before arrayBuffer())
  const tooLarge = images.find((f) => f.size > MAX_BYTES_PER_IMAGE);
  if (tooLarge) {
    return NextResponse.json(
      {
        ok: false,
        error: "file_too_large",
        message: `Max ${Math.round(
          MAX_BYTES_PER_IMAGE / (1024 * 1024)
        )}MB per image. Downscale or export as JPG/WebP and retry.`,
        max_bytes_per_image: MAX_BYTES_PER_IMAGE,
        filename: tooLarge.name,
        size_bytes: tooLarge.size,
      },
      { status: 413 }
    );
  }

  const debug_images = await Promise.all(
    images.map(async (f) => {
      const bytes = Buffer.from(await f.arrayBuffer());

      const inputMeta = await sharp(bytes).metadata();
      const inputW = inputMeta.width ?? null;
      const inputH = inputMeta.height ?? null;

      // Resize first to bound later work
      const resizedBytes = await sharp(bytes)
        .resize({
          width: MAX_DIM,
          height: MAX_DIM,
          fit: "inside",
          withoutEnlargement: true,
        })
        .toBuffer();

      const resizedMeta = await sharp(resizedBytes).metadata();

      // Read pixels
      const { data, info } = await sharp(resizedBytes)
        .raw()
        .toBuffer({ resolveWithObject: true });

      const channels = info.channels; // usually 3 (RGB) or 4 (RGBA)
      const pixelCount = info.width * info.height;

      // Average color (skip fully transparent pixels if RGBA)
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let count = 0;

      for (let i = 0; i < data.length; i += channels) {
        const a = channels === 4 ? data[i + 3] : 255;
        if (a === 0) continue;

        rSum += data[i];
        gSum += data[i + 1];
        bSum += data[i + 2];
        count += 1;
      }

      const denom = Math.max(1, count);
      const avg = {
        r: Math.round(rSum / denom),
        g: Math.round(gSum / denom),
        b: Math.round(bSum / denom),
      };

      // Sample 10 pixels spread through the buffer (ignores alpha)
      const samples: Array<{ r: number; g: number; b: number }> = [];
      const step = Math.max(1, Math.floor(pixelCount / 10));
      for (let p = 0; p < 10; p++) {
        const idxPixel = Math.min(pixelCount - 1, p * step);
        const i = idxPixel * channels;
        samples.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
      }

      // Cheap histogram palette
      const BUCKET = 24; // bigger = fewer buckets (faster, coarser)
      const hist = new Map<
        string,
        { r: number; g: number; b: number; count: number }
      >();

      for (let i = 0; i < data.length; i += channels) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = channels === 4 ? data[i + 3] : 255;
        if (a === 0) continue;

        const br = Math.round(r / BUCKET) * BUCKET;
        const bg = Math.round(g / BUCKET) * BUCKET;
        const bb = Math.round(b / BUCKET) * BUCKET;

        const key = `${br},${bg},${bb}`;
        const existing = hist.get(key);
        if (existing) existing.count += 1;
        else hist.set(key, { r: br, g: bg, b: bb, count: 1 });
      }

      const ranked = [...hist.values()].sort((x, y) => y.count - x.count);

      // Pick top colors, skipping near-duplicates
      const picked: Array<{ r: number; g: number; b: number }> = [];
      const MIN_DIST2 = 40 * 40;

      for (const c of ranked) {
        if (picked.length >= 8) break;
        if (picked.every((p) => dist2(p, c) >= MIN_DIST2)) {
          picked.push({ r: c.r, g: c.g, b: c.b });
        }
      }

      const avg_hex = rgbToHex(avg.r, avg.g, avg.b);
      const sample_hex = samples.map((s) => rgbToHex(s.r, s.g, s.b));
      const draft_palette_hex = picked.map((c) => rgbToHex(c.r, c.g, c.b));

      return {
        filename: f.name,
        type: f.type,
        size_bytes: f.size,
        format: inputMeta.format ?? null,

        avg_hex,
        sample_hex,
        draft_palette_hex,

        input: { width: inputW, height: inputH, bytes: bytes.length },
        resized: {
          width: resizedMeta.width ?? null,
          height: resizedMeta.height ?? null,
          bytes: resizedBytes.length,
        },

        pixels: {
          width: info.width,
          height: info.height,
          channels,
          pixelCount,
          usedPixelCount: count,
        },
        avg_rgb: avg,
        sample_rgb: samples,
      };
    })
  );

  // Map extracted palette into your color_system (simple default strategy)
  const first = debug_images[0];
  const palette = first?.draft_palette_hex ?? [];

  const pick = (i: number, fallback: string) => palette[i] ?? fallback;

  const color_system = {
    version: "1.0",
    meta: {
      id: "cs_generated",
      mode,
      source: {
        image_count: images.length,
        max_dim: MAX_DIM,
        max_bytes_per_image: MAX_BYTES_PER_IMAGE,
        notes: "generated from uploaded images",
      },
      generated_at: new Date().toISOString(),
      engine: { name: "hexed", engine_version: "0.1.0" },
      timing_ms: null as number | null,
    },
    colors: {
      core: {
        primary: { hex: pick(5, "#3B6EF5"), space: "srgb" },
        secondary: { hex: pick(3, "#1CC7A1"), space: "srgb" },
        accent: { hex: pick(4, "#FF4D6D"), space: "srgb" },
      },
      neutrals: {
        ramp: [
          { step: 50, hex: "#F7F8FA" },
          { step: 100, hex: "#EDF0F4" },
          { step: 200, hex: "#D8DEE8" },
          { step: 300, hex: "#C3CCDA" },
          { step: 400, hex: "#A5B1C5" },
          { step: 500, hex: "#7E8AA3" },
          { step: 600, hex: "#5C667D" },
          { step: 700, hex: "#3F475A" },
          { step: 800, hex: "#2A2F3D" },
          { step: 900, hex: "#151825" },
        ],
        intent: "cool_neutral",
      },
      semantic: {
        success: { hex: "#1DB954", space: "srgb" },
        warning: { hex: "#F5A623", space: "srgb" },
        error: { hex: "#E02424", space: "srgb" },
        info: { hex: pick(5, "#3B6EF5"), space: "srgb" },
      },
    },
    ui: {
      themes: {
        light: {
          background: { hex: "#F7F8FA" },
          surface: { hex: "#FFFFFF" },
          surface_muted: { hex: "#EDF0F4" },
          text: { hex: "#151825" },
          text_muted: { hex: "#3F475A" },
          border: { hex: "#D8DEE8" },
          focus: { hex: pick(5, "#3B6EF5") },

          primary: { hex: pick(5, "#3B6EF5") },
          primary_on: { hex: "#FFFFFF" },
          secondary: { hex: pick(3, "#1CC7A1") },
          secondary_on: { hex: "#0B1B16" },
          accent: { hex: pick(4, "#FF4D6D") },
          accent_on: { hex: "#2A0B12" },

          success: { hex: "#1DB954" },
          warning: { hex: "#F5A623" },
          error: { hex: "#E02424" },
        },
        dark: {
          background: { hex: "#151825" },
          surface: { hex: "#1D2233" },
          surface_muted: { hex: "#2A2F3D" },
          text: { hex: "#F7F8FA" },
          text_muted: { hex: "#C3CCDA" },
          border: { hex: "#3F475A" },
          focus: { hex: pick(5, "#3B6EF5") },

          primary: { hex: pick(5, "#3B6EF5") },
          primary_on: { hex: "#FFFFFF" },
          secondary: { hex: pick(3, "#1CC7A1") },
          secondary_on: { hex: "#04110E" },
          accent: { hex: pick(4, "#FF4D6D") },
          accent_on: { hex: "#1A070C" },

          success: { hex: "#1DB954" },
          warning: { hex: "#F5A623" },
          error: { hex: "#E02424" },
        },
      },
    },
    validation: {
      wcag: {
        standard: "WCAG2.2",
        text_size_assumption: "normal",
        target: "AA",
        pairs: [] as any[],
        failures: [] as any[],
      },
      print: { method: "approx", warnings: [] as string[] },
    },
    exports: {
      available: ["css_variables", "tailwind_config", "figma_tokens_json"],
      notes: "Exports generated on demand.",
    },
  };

  return NextResponse.json(
    {
      ok: true,
      received: debug_images.map(({ filename, type, size_bytes }) => ({
        filename,
        type,
        size_bytes,
      })),
      debug: { images: debug_images },
      color_system,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}

// Optional: keep GET as a helpful message instead of 404
export async function GET() {
  return NextResponse.json({
    ok: false,
    error: "use_post",
    message:
      "POST 1–5 images as multipart/form-data with field name 'images' (or 'image' for single).",
  });
}
