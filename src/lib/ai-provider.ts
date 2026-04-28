// Server-only AI provider — Gemini-only cascade.
//
// Model order (all confirmed valid as of April 2026 via ai.google.dev/gemini-api/docs/models):
//   1. gemini-2.5-flash       — stable, best price-performance
//   2. gemini-2.5-flash-lite  — stable, fastest + cheapest in 2.5 family (separate quota bucket)
//   3. gemini-2.5-pro         — stable, deepest reasoning
//   4. gemini-2.0-flash       — deprecated but still available, different quota pool
//   5. gemini-flash-latest    — latest alias (resolves to current stable flash, avoids 404)
//
// Strategy against 429s:
//   - 5-second pause between attempts lets per-minute quota partially recover.
//   - Each model has its own rate-limit bucket, so a 429 on one may pass on another.
//
// All calls use responseMimeType: "application/json" — no code-fence stripping needed.

export type AIChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIResult = {
  content: string | null;
  provider: "gemini" | null;
  model: string | null;
  error: string | null;
};

// Models in priority order. Each has its own quota bucket at Google's side.
const GEMINI_MODELS = [
  "gemini-2.5-flash",       // primary — stable, best value
  "gemini-2.5-flash-lite",  // fast fallback — lightest 2.5 model, separate quota
  "gemini-2.5-pro",         // deep reasoning fallback
  "gemini-2.0-flash",       // deprecated but available — different quota pool
  "gemini-flash-latest",    // version alias — resolves to current stable flash
];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Simple XOR + Base64 decryption for public safety obfuscation
function decryptKey(enc: string): string {
  const SECRET = "GK_STOCKS_2026";
  try {
    // Universal base64 decode (Buffer in Node, atob in browser)
    const decoded = typeof Buffer !== 'undefined' 
      ? Buffer.from(enc, 'base64').toString('utf8')
      : atob(enc);
      
    return decoded.split('').map((char, i) => 
      String.fromCharCode(char.charCodeAt(0) ^ SECRET.charCodeAt(i % SECRET.length))
    ).join('');
  } catch {
    return "";
  }
}

const ENC_KEY = "BgIlMgc2AjJqbgRERmw3Hj4DFws5GwUcR1Z6XRV6PicRdhIUOCxV";

async function callGemini(
  messages: AIChatMessage[],
  model: string,
): Promise<AIResult> {
  let apiKey =
    process.env.USER_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY_TIER3 ||
    process.env.GEMINI_API_KEY_FREE;

  // If no env var found (production/public), use the obfuscated key
  if (!apiKey || apiKey.length < 10) {
    apiKey = decryptKey(ENC_KEY);
  }

  if (!apiKey) {
    return { content: null, provider: null, model: null, error: "no-key" };
  }

  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: system
            ? {
                parts: [
                  {
                    text:
                      system +
                      "\n\nIMPORTANT: Respond with ONLY a valid JSON object. No markdown, no code fences, no commentary.",
                  },
                ],
              }
            : undefined,
          contents,
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7,
          },
        }),
      },
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return {
        content: null,
        provider: null,
        model: null,
        error: `user-gemini-${res.status}:${txt.slice(0, 160)}`,
      };
    }

    const json = await res.json();
    const content: string =
      json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!content) {
      return {
        content: null,
        provider: null,
        model: null,
        error: `user-gemini-empty (model: ${model})`,
      };
    }

    return { content, provider: "gemini", model, error: null };
  } catch (e) {
    return {
      content: null,
      provider: null,
      model: null,
      error: `user-gemini-throw:${e instanceof Error ? e.message : "unknown"}`,
    };
  }
}

// Returns true for any error that warrants trying the next model.
function shouldFallback(err: string | null): boolean {
  if (!err) return false;
  if (err === "no-key") return true;
  if (err.includes("empty")) return true;
  if (err.includes("throw")) return true;
  // Any HTTP error (401, 402, 403, 404, 429, 5xx, 529) → try next model
  return /-(401|402|403|404|429|5\d\d|529)\b/.test(err) || /-\d{3}:/.test(err);
}

export async function callAIWithFallback(
  messages: AIChatMessage[],
): Promise<AIResult> {
  const errors: string[] = [];

  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    // Wait 5 seconds between attempts so per-minute quota partially recovers.
    if (i > 0) await sleep(5000);

    const model = GEMINI_MODELS[i];
    const result = await callGemini(messages, model);

    if (result.content && !result.error) {
      return result;
    }

    errors.push(`${model}: ${result.error ?? "unknown"}`);

    if (!shouldFallback(result.error)) {
      // Non-retriable hard error — still try next model for resilience
    }
  }

  return {
    content: null,
    provider: null,
    model: null,
    error: `All Gemini models failed. ${errors.join(" | ")}`,
  };
}

// Helper: strip accidental code fences and parse JSON.
export function parseAIJson<T>(content: string): T | null {
  const cleaned = content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
