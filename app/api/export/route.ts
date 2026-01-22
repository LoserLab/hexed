import { NextRequest, NextResponse } from "next/server";

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

  const primary = cs.colors?.core?.primary?.hex;
  const secondary = cs.colors?.core?.secondary?.hex;
  const accent = cs.colors?.core?.accent?.hex;

  if (assertHex(primary)) lines.push(`  --color-primary: ${primary};`);
  if (assertHex(secondary)) lines.push(`  --color-secondary: ${secondary};`);
  if (assertHex(accent)) lines.push(`  --color-accent: ${accent};`);

  const sem = cs.colors?.semantic;
  if (assertHex(sem?.success?.hex)) lines.push(`  --color-success: ${sem!.success!.hex};`);
  if (assertHex(sem?.warning?.hex)) lines.push(`  --color-warning: ${sem!.warning!.hex};`);
  if (assertHex(sem?.error?.hex)) lines.push(`  --color-error: ${sem!.error!.hex};`);
  if (assertHex(sem?.info?.hex)) lines.push(`  --color-info: ${sem!.info!.hex};`);

  const ramp = cs.colors?.neutrals?.ramp ?? [];
  for (const n of ramp) {
    if (typeof n?.step === "number" && assertHex(n.hex)) {
      lines.push(`  --neutral-${n.step}: ${n.hex};`);
    }
  }

  const themes = cs.ui?.themes;
  const light = themes?.light ?? {};
  const dark = themes?.dark ?? {};

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

  const darkBlock = darkLines.length > 0 ? `\n[data-theme="dark"] {\n${darkLines.join("\n")}\n}\n` : "";

  return rootBlock + lightBlock + darkBlock;
}

function toTailwindConfig(cs: ColorSystem) {
  // Minimal usable config snippet. You can expand later.
  const primary = cs.colors?.core?.primary?.hex;
  const secondary = cs.colors?.core?.secondary?.hex;
  const accent = cs.colors?.core?.accent?.hex;

  const ramp = cs.colors?.neutrals?.ramp ?? [];

  const neutrals: Record<string, string> = {};
  for (const n of ramp) {
    if (typeof n?.step === "number" && assertHex(n.hex)) neutrals[String(n.step)] = n.hex;
  }

  const semantic = cs.colors?.semantic ?? {};

  const payload = {
    theme: {
      extend: {
        colors: {
          primary: assertHex(primary) ? primary : undefined,
          secondary: assertHex(secondary) ? secondary : undefined,
          accent: assertHex(accent) ? accent : undefined,
          neutral: Object.keys(neutrals).length ? neutrals : undefined,
          success: assertHex(semantic.success?.hex) ? semantic.success!.hex : undefined,
          warning: assertHex(semantic.warning?.hex) ? semantic.warning!.hex : undefined,
          error: assertHex(semantic.error?.hex) ? semantic.error!.hex : undefined,
          info: assertHex(semantic.info?.hex) ? semantic.info!.hex : undefined,
        },
      },
    },
  };

  // Emit as JS module so it can be pasted into tailwind.config.(js|ts)
  return `/* hexed export: tailwind_config */
export default ${JSON.stringify(payload, null, 2)};
`;
}

function toFigmaTokens(cs: ColorSystem) {
  // Keep it simple: return the color_system wrapped as a tokens-ish object.
  // You can conform to a stricter spec later if needed.
  return {
    name: "hexed",
    version: cs.version,
    color_system: cs,
  };
}

export async function POST(req: NextRequest) {
  const format = (req.nextUrl.searchParams.get("format") || "css").toLowerCase();

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

  if (format === "css") {
    const css = toCssVars(cs);
    return new NextResponse(css, {
      status: 200,
      headers: { "content-type": "text/css; charset=utf-8", "cache-control": "no-store" },
    });
  }

  if (format === "tailwind") {
    const js = toTailwindConfig(cs);
    return new NextResponse(js, {
      status: 200,
      headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" },
    });
  }

  if (format === "figma") {
    const json = toFigmaTokens(cs);
    return NextResponse.json(json, { status: 200, headers: { "cache-control": "no-store" } });
  }

  return NextResponse.json(
    { ok: false, error: "bad_format", message: "Use ?format=css|tailwind|figma" },
    { status: 400 }
  );
}

export async function GET(req: NextRequest) {
  const format = (req.nextUrl.searchParams.get("format") || "css").toLowerCase();
  return NextResponse.json({
    ok: false,
    error: "use_post",
    message: `POST JSON { color_system } to /api/export?format=${format} (supported: css, tailwind, figma).`,
  });
}
