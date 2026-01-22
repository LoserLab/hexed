import { NextResponse } from "next/server";

type ColorSystem = {
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

function toTailwind(cs: ColorSystem) {
  const colors: Record<string, string | Record<string, string>> = {};

  // Core colors
  if (assertHex(cs.colors?.core?.primary?.hex)) {
    colors.primary = cs.colors!.core!.primary!.hex;
  }
  if (assertHex(cs.colors?.core?.secondary?.hex)) {
    colors.secondary = cs.colors!.core!.secondary!.hex;
  }
  if (assertHex(cs.colors?.core?.accent?.hex)) {
    colors.accent = cs.colors!.core!.accent!.hex;
  }

  // Semantic colors
  const sem = cs.colors?.semantic;
  if (assertHex(sem?.success?.hex)) colors.success = sem!.success!.hex;
  if (assertHex(sem?.warning?.hex)) colors.warning = sem!.warning!.hex;
  if (assertHex(sem?.error?.hex)) colors.error = sem!.error!.hex;
  if (assertHex(sem?.info?.hex)) colors.info = sem!.info!.hex;

  // Neutral ramp
  const ramp = cs.colors?.neutrals?.ramp;
  if (Array.isArray(ramp) && ramp.length > 0) {
    const neutral: Record<string, string> = {};
    for (const n of ramp) {
      if (typeof n.step === "number" && assertHex(n.hex)) {
        neutral[n.step.toString()] = n.hex;
      }
    }
    if (Object.keys(neutral).length > 0) {
      colors.neutral = neutral;
    }
  }

  return `// hexed export: tailwind_config
export default {
  theme: {
    extend: {
      colors: ${JSON.stringify(colors, null, 8)}
    }
  }
};
`;
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

  const js = toTailwind(cs);

  return new NextResponse(js, {
    status: 200,
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function GET() {
  return NextResponse.json({
    ok: false,
    error: "use_post",
    message: "POST JSON { color_system } and receive a Tailwind config snippet.",
  });
}
