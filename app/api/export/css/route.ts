import { NextResponse } from "next/server";

type ColorSystem = {
  version: string;
  colors?: {
    core?: {
      primary?: { hex: string };
      secondary?: { hex: string };
      accent?: { hex: string };
    };
    neutrals?: {
      ramp?: Array<{ step: number; hex: string }>;
    };
    semantic?: {
      success?: { hex: string };
      warning?: { hex: string };
      error?: { hex: string };
      info?: { hex: string };
    };
  };
  ui?: {
    themes?: {
      light?: Record<string, { hex: string }>;
      dark?: Record<string, { hex: string }>;
    };
  };
};

function assertHex(x: unknown): x is string {
  return typeof x === "string" && /^#[0-9A-Fa-f]{6}$/.test(x);
}

function safeVar(name: string) {
  return name.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
}

function toCssVars(cs: ColorSystem) {
  const lines: string[] = [];
  lines.push("/* hexed export: css_variables */");

  // Core
  const primary = cs.colors?.core?.primary?.hex;
  const secondary = cs.colors?.core?.secondary?.hex;
  const accent = cs.colors?.core?.accent?.hex;

  if (assertHex(primary)) lines.push(`  --color-primary: ${primary};`);
  if (assertHex(secondary)) lines.push(`  --color-secondary: ${secondary};`);
  if (assertHex(accent)) lines.push(`  --color-accent: ${accent};`);

  // Semantics
  const sem = cs.colors?.semantic;
  if (assertHex(sem?.success?.hex)) lines.push(`  --color-success: ${sem!.success!.hex};`);
  if (assertHex(sem?.warning?.hex)) lines.push(`  --color-warning: ${sem!.warning!.hex};`);
  if (assertHex(sem?.error?.hex)) lines.push(`  --color-error: ${sem!.error!.hex};`);
  if (assertHex(sem?.info?.hex)) lines.push(`  --color-info: ${sem!.info!.hex};`);

  // Neutrals ramp
  const ramp = cs.colors?.neutrals?.ramp ?? [];
  for (const n of ramp) {
    if (typeof n?.step === "number" && assertHex(n.hex)) {
      lines.push(`  --neutral-${n.step}: ${n.hex};`);
    }
  }

  // Theme vars (optional)
  const themes = cs.ui?.themes;
  const light = themes?.light ?? {};
  const dark = themes?.dark ?? {};

  // put theme tokens under separate selectors so people can pick a strategy
  const lightLines: string[] = [];
  for (const [k, v] of Object.entries(light)) {
    if (assertHex(v?.hex)) lightLines.push(`  --${safeVar(k)}: ${v.hex};`);
  }

  const darkLines: string[] = [];
  for (const [k, v] of Object.entries(dark)) {
    if (assertHex(v?.hex)) darkLines.push(`  --${safeVar(k)}: ${v.hex};`);
  }

  const rootBlock =
    lines.length > 1
      ? `:root {\n${lines.join("\n")}\n}\n`
      : `:root {\n  /* no vars generated */\n}\n`;

  const lightBlock =
    lightLines.length > 0
      ? `\n/* Suggested mapping */\n[data-theme="light"] {\n${lightLines.join("\n")}\n}\n`
      : "";

  const darkBlock =
    darkLines.length > 0
      ? `\n[data-theme="dark"] {\n${darkLines.join("\n")}\n}\n`
      : "";

  return rootBlock + lightBlock + darkBlock;
}

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "bad_json", message: "POST JSON body: { color_system: {...} }" },
      { status: 400 }
    );
  }

  const cs = (body as any)?.color_system as ColorSystem | undefined;

  if (!cs || typeof cs !== "object") {
    return NextResponse.json(
      { ok: false, error: "missing_color_system", message: "Body must include { color_system }" },
      { status: 400 }
    );
  }

  const css = toCssVars(cs);

  return new NextResponse(css, {
    status: 200,
    headers: {
      "content-type": "text/css; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

// Helpful GET message
export async function GET() {
  return NextResponse.json({
    ok: false,
    error: "use_post",
    message: "POST JSON { color_system } and you'll get back text/css with variables.",
  });
}
