// Server-only AI provider — Gemini-only cascade.
// Version: 2026-04-28-17:35-RobustFallback
//
// Model order (Updated May 2026 for v1beta):
//   1. gemini-3.1-pro-preview        — frontier reasoning
//   2. gemini-3-flash-preview        — ultra-fast next-gen
//   3. gemini-3.1-flash-lite-preview — lightest next-gen
//   4. gemini-2.5-flash              — stable workhorse
//   5. gemini-2.5-pro                — deep reasoning fallback
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
import { decryptKey } from "./security-utils";

const GEMINI_MODELS = [
  "gemini-3.1-pro-preview",       // primary — frontier reasoning (v1beta)
  "gemini-3-flash-preview",       // secondary — ultra-fast next-gen
  "gemini-3.1-flash-lite-preview",// tertiary — lightest next-gen
  "gemini-2.5-flash",             // fallback family 1
  "gemini-2.5-flash-lite",        // fallback family 2
  "gemini-2.5-pro",               // deep reasoning fallback
];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const ENC_KEY = "BgIlMgc2ABI7G2FGdkMqAgg6IywqOwkNRQNZD3UBaWokLgQRFWZZ";

async function callGemini(
  messages: AIChatMessage[],
  model: string,
  keyOverride?: string,
): Promise<AIResult> {
  const apiKey = keyOverride || decryptKey(ENC_KEY);

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
            temperature: 0.1,
            maxOutputTokens: 8192,
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          ],
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
  userKey?: string,
): Promise<AIResult> {
  const errors: string[] = [];
  
  // Pass 0: Try with User-Provided Key (Highest Priority)
  if (userKey) {
    console.log("🚀 Using User-Provided Gemini Pro Key...");
    for (let i = 0; i < GEMINI_MODELS.length; i++) {
      const model = GEMINI_MODELS[i];
      const result = await callGemini(messages, model, userKey);

      if (result.content && !result.error) return result;
      
      if (result.error?.includes("429")) {
        console.warn(`[UserKey] Rate limited on ${model}. Waiting 5s...`);
        await sleep(5000);
      } else {
        if (i < GEMINI_MODELS.length - 1) await sleep(2000);
      }
      
      errors.push(`[UserKey] ${model}: ${result.error ?? "unknown"}`);
    }
  }

  // Pass 1: Try with Environment Keys
  const envKey = process.env.USER_GEMINI_API_KEY || process.env.GEMINI_API_KEY_TIER3 || process.env.GEMINI_API_KEY_FREE;
  
  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const model = GEMINI_MODELS[i];
    const result = await callGemini(messages, model, envKey);

    if (result.content && !result.error) return result;
    
    // If we hit 429, wait significantly longer (15s) to let the window reset
    if (result.error?.includes("429")) {
      console.warn(`[EnvKey] Rate limited on ${model}. Waiting 15s...`);
      await sleep(15000);
    } else {
      if (i < GEMINI_MODELS.length - 1) await sleep(5000);
    }
    
    errors.push(`[EnvKey] ${model}: ${result.error ?? "unknown"}`);
  }

  // Pass 2: Fallback to Obfuscated Key
  const safetyKey = decryptKey(ENC_KEY);
  if (safetyKey) {
    console.log("⚠️ Pass 1 complete. Attempting Pass 2 (Safety Key)...");
    for (let i = 0; i < GEMINI_MODELS.length; i++) {
      const model = GEMINI_MODELS[i];
      const result = await callGemini(messages, model, safetyKey);

      if (result.content && !result.error) return result;
      
      if (result.error?.includes("429")) {
        await sleep(10000);
      } else {
        if (i < GEMINI_MODELS.length - 1) await sleep(2000);
      }
      
      errors.push(`[SafetyKey] ${model}: ${result.error ?? "unknown"}`);
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
  if (!content) return null;
  
  // 1. Aggressive cleaning of markdown fences and control characters
  let text = content
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();

  // 2. Try regex-based extraction to find the main JSON object/array
  // This helps if there's leading/trailing prose
  const jsonRegex = /({[\s\S]*}|\[[\s\S]*\])/;
  const match = text.match(jsonRegex);
  if (match) {
    text = match[0];
  }

  // 3. Direct Parse Attempt
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    // 4. Aggressive Recovery for common LLM failure patterns
    try {
      let fix = text
        .replace(/,\s*([\]}])/g, "$1") // Trailing commas
        .replace(/(\r\n|\n|\r)/gm, " ") // Newlines
        .replace(/\s+/g, " ")           // Excessive whitespace
        .trim();

      // If it looks like it might have a "picks" key but is broken
      if (fix.includes('"picks"') && !fix.startsWith("{")) {
        const pStart = fix.indexOf('"picks"');
        const startBracket = fix.indexOf("[", pStart);
        if (startBracket !== -1) {
           // Try to isolate the array
           fix = "{" + fix.substring(pStart);
           if (!fix.endsWith("}")) fix += "]}";
        }
      }

      const start = fix.indexOf("{");
      const end = fix.lastIndexOf("}");
      
      if (start !== -1) {
        let extracted = end > start ? fix.substring(start, end + 1) : fix.substring(start);
        
        let stack: string[] = [];
        let inString = false;
        let escaped = false;
        
        for (let i = 0; i < extracted.length; i++) {
          const char = extracted[i];
          if (escaped) { escaped = false; continue; }
          if (char === "\\") { escaped = true; continue; }
          if (char === '"') { inString = !inString; continue; }
          if (!inString) {
            if (char === "{") stack.push("}");
            if (char === "[") stack.push("]");
            if (char === "}") stack.pop();
            if (char === "]") stack.pop();
          }
        }
        
        if (inString) extracted += '"';
        while (stack.length > 0) extracted += stack.pop();
        
        return JSON.parse(extracted) as T;
      }
    } catch (err) {
      console.warn("Deep JSON recovery failed:", (err as Error).message);
    }
    return null;
  }
}
