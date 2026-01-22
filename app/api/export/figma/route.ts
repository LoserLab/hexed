import { NextResponse } from "next/server";

function asHex(v: any): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && typeof v.hex === "string") return v.hex;
  return null;
}

// Minimal “Tokens Studio for Figma” style structure.
// This is intentionally simple and low-lift.
// You can expand later (typography, spacing, shadows, aliases, etc).
function toFigmaTokens(color_system: any) {
  const light = color_system?.ui?.themes?.light ?? {};
  const dark = color_system?.ui?.themes?.dark ?? {};
  const neutrals = color_system?.colors?.neutrals?.ramp ?? [];
  const core = color_system?.colors?.core ?? {};
  const semantic = color_system?.colors?.semantic ?? {};

  const tokens: any = {
    $metadata: {
      name: "Hexed",
      generated_at: color_system?.meta?.generated_at ?? new Date().toISOString(),
      engine: color_system?.meta?.engine ?? null,
      mode: color_system?.meta?.mode ?? null,
      version: color_system?.version ?? null,
    },
    // Tokens Studio commonly uses “collections” as top-level groups.
    // This shape is compatible enough for importing as JSON tokens.
    colors: {
      core: {},
      semantic: {},
      neutrals: {},
      ui: {
        light: {},
        dark: {},
      },
    },
  };

  // Core (primary/secondary/accent)
  for (const [k, v] of Object.entries(core)) {
    const hex = asHex(v);
    if (!hex) continue;
    tokens.colors.core[k] = { value: hex, type: "color" };
  }

  // Semantic (success/warning/error/info)
  for (const [k, v] of Object.entries(semantic)) {
    const hex = asHex(v);
    if (!hex) continue;
    tokens.colors.semantic[k] = { value: hex, type: "color" };
  }

  // Neutrals ramp
  for (const n of neutrals) {
    if (!n?.step || !n?.hex) continue;
    tokens.colors.neutrals[String(n.step)] = { value: n.hex, type: "color" };
  }

  // UI tokens (light/dark)
  for (const [k, v] of Object.entries(light)) {
    const hex = asHex(v);
    if (!hex) continue;
    tokens.colors.ui.light[k] = { value: hex, type: "color" };
  }

  for (const [k, v] of Object.entries(dark)) {
    const hex = asHex(v);
    if (!hex) continue;
    tokens.colors.ui.dark[k] = { value: hex, type: "color" };
  }

  return tokens;
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json", message: "POST JSON { color_system }." },
      { status: 400 }
    );
  }

  const color_system = body?.color_system ?? body;
  if (!color_system || typeof color_system !== "object") {
    return NextResponse.json(
      { ok: false, error: "missing_color_system", message: "POST JSON { color_system }." },
      { status: 400 }
    );
  }

  const tokens = toFigmaTokens(color_system);

  return NextResponse.json({
    ok: true,
    export: {
      format: "figma_tokens_json",
      filename: "hexed.tokens.json",
    },
    tokens,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: false,
    error: "use_post",
    message: "POST JSON { color_system } and you'll get back a Figma tokens JSON payload.",
  });
}
