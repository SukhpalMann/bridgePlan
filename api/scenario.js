import {randomUUID} from "node:crypto";
import {InputError, SYSTEM_PROMPT, calculateScenario, modelIntent, normalizeInput, safeModelOutput} from "../lib/scenario-core.mjs";

const MODEL = "gemini-3.5-flash-lite";
const TABLE = "bridgeplan_runs";
const VISITOR_CAP = 5;
const DAILY_CAP = 200;
const MAX_OUTPUT_TOKENS = 300;

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function config() {
  const {GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY} = process.env;
  if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error("Server configuration is incomplete.");
  const url = new URL(SUPABASE_URL);
  if (url.protocol !== "https:") throw new Error("Supabase URL must use HTTPS.");
  return {GEMINI_API_KEY, SUPABASE_URL: url.origin, SUPABASE_SERVICE_KEY};
}

function dbHeaders(key, extra = {}) {
  return {apikey:key, Authorization:`Bearer ${key}`, "Content-Type":"application/json", ...extra};
}

async function dbRequest(settings, path, init = {}) {
  const res = await fetch(`${settings.SUPABASE_URL}/rest/v1/${TABLE}${path}`, {
    ...init,
    headers: dbHeaders(settings.SUPABASE_SERVICE_KEY, init.headers)
  });
  if (!res.ok) throw new Error(`Database request failed (${res.status}).`);
  return res;
}

async function countRows(settings, filters = "") {
  const res = await dbRequest(settings, `?select=id${filters}`, {
    method:"HEAD", headers:{Prefer:"count=exact"}
  });
  const contentRange = res.headers.get("content-range");
  const count = Number(contentRange?.split("/")[1]);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("Database count is unavailable.");
  return count;
}

async function saveRow(settings, row) {
  await dbRequest(settings, "", {
    method:"POST", headers:{Prefer:"return=minimal"}, body:JSON.stringify(row)
  });
}

async function updateRow(settings, id, changes) {
  await dbRequest(settings, `?id=eq.${encodeURIComponent(id)}`, {
    method:"PATCH", headers:{Prefer:"return=minimal"}, body:JSON.stringify(changes)
  });
}

async function askGemini(settings, intent) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method:"POST",
    headers:{"Content-Type":"application/json", "x-goog-api-key":settings.GEMINI_API_KEY},
    body:JSON.stringify({
      systemInstruction:{parts:[{text:SYSTEM_PROMPT}]},
      contents:[{role:"user", parts:[{text:JSON.stringify(intent)}]}],
      generationConfig:{
        temperature:0.25, maxOutputTokens:MAX_OUTPUT_TOKENS,
        responseMimeType:"application/json",
        responseSchema:{
          type:"OBJECT",
          properties:{
            summary:{type:"STRING"},
            questions:{type:"ARRAY", items:{type:"STRING"}},
            refusal:{type:"BOOLEAN"}
          },
          required:["summary","questions","refusal"]
        }
      }
    }),
    signal:AbortSignal.timeout(12_000)
  });
  if (!res.ok) throw new Error(`Gemini request failed (${res.status}).`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("");
  if (!text) throw new Error("Gemini returned no usable response.");
  return {
    raw:JSON.parse(text),
    inputTokens:data.usageMetadata?.promptTokenCount ?? null,
    outputTokens:data.usageMetadata?.candidatesTokenCount ?? null
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, {error:"Method not allowed."});
  }
  let settings;
  try { settings = config(); }
  catch { return send(res, 503, {error:"The scenario check is not connected yet."}); }

  if (req.method === "GET") {
    try {
      const completed = await countRows(settings, "&status=eq.completed");
      return send(res, 200, {checksCompleted:completed});
    } catch {
      return send(res, 503, {error:"Usage count is temporarily unavailable."});
    }
  }

  let input;
  try {
    if (Number(req.headers?.["content-length"] || 0) > 6_000) throw new InputError("The request is too large.");
    input = normalizeInput(typeof req.body === "string" ? JSON.parse(req.body) : req.body);
  } catch (error) {
    return send(res, 400, {error:error instanceof InputError ? error.message : "Enter a valid scenario."});
  }

  try {
    const visitorCount = await countRows(settings, `&visitor_id=eq.${encodeURIComponent(input.visitorId)}`);
    if (visitorCount >= VISITOR_CAP) return send(res, 429, {error:"You've used your five scenario checks in this browser."});
    const since = encodeURIComponent(new Date(Date.now() - 86_400_000).toISOString());
    const dailyCount = await countRows(settings, `&created_at=gte.${since}`);
    if (dailyCount >= DAILY_CAP) return send(res, 429, {error:"Today's demo capacity has been reached. Please try again tomorrow."});

    const result = calculateScenario(input);
    const id = randomUUID();
    const storedInput = {...input};
    delete storedInput.visitorId;
    await saveRow(settings, {
      id, visitor_id:input.visitorId, visitor_slot:visitorCount + 1, scenario_input:storedInput,
      calculation:result, model_output:{status:"pending"}, status:"pending"
    });
    try {
      const gemini = await askGemini(settings, modelIntent(input, result));
      const answer = safeModelOutput(gemini.raw, input.focus);
      await updateRow(settings, id, {
        model_output:answer, status:"completed",
        input_tokens:gemini.inputTokens, output_tokens:gemini.outputTokens
      });
      const checksCompleted = await countRows(settings, "&status=eq.completed");
      return send(res, 200, {calculation:result, answer, checksCompleted, remaining:VISITOR_CAP - visitorCount - 1});
    } catch (error) {
      try {
        await updateRow(settings, id, {status:"failed", model_output:{error:"Generation unavailable."}});
      } catch { /* Keep the pending audit row when the database is unavailable. */ }
      throw error;
    }
  } catch (error) {
    console.error("BridgePlan scenario error:", error?.message || "unknown error");
    return send(res, 503, {error:"The scenario check is temporarily unavailable. Please try again later."});
  }
}
