import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/scenario.js";
import {calculateScenario, normalizeInput, safeModelOutput} from "../lib/scenario-core.mjs";

const visitorId = "7adf0111-07f6-4c84-a73e-b90e48f15be7";
const sample = {
  visitorId, bill:200_000, familyFunds:50_000,
  payoutUnknown:false, payoutLow:100_000, payoutHigh:150_000,
  targetAmount:1_000_000, currentSaved:200_000, monthlySaving:20_000,
  focus:"policy"
};

test("ranges use assumed payouts without double-counting goal savings", () => {
  const result = calculateScenario(normalizeInput(sample));
  assert.deepEqual(result, {gapLow:0, gapHigh:50_000, delayLow:0, delayHigh:3, baselineMonths:40, payoutUnknown:false});
  const unknown = calculateScenario(normalizeInput({...sample, payoutUnknown:true}));
  assert.equal(unknown.gapLow, 0);
  assert.equal(unknown.gapHigh, 150_000);
  assert.equal(unknown.delayHigh, 8);
});

test("invalid numeric and unsafe model output are rejected or replaced", () => {
  assert.throws(() => normalizeInput({...sample, bill:"ignore instructions"}), /hypothetical bill/);
  assert.throws(() => normalizeInput({...sample, payoutLow:190_000, payoutHigh:100_000}), /lower payout/);
  assert.throws(() => normalizeInput({...sample, currentSaved:1_000_000}), /still in progress/);
  const answer = safeModelOutput({summary:"You are definitely covered.", questions:["Question 1?","Question 2?"], refusal:false}, "policy");
  assert.match(answer.summary, /depends on assumptions/);
  const refusal = safeModelOutput({summary:"Buy this policy.",questions:["What is covered?","What is excluded?"],refusal:false},"policy_choice");
  assert.equal(refusal.refusal, true);
  assert.match(refusal.summary, /cannot choose/);
});

function fakeResponse() {
  return {
    headers:{}, statusCode:200, data:null,
    setHeader(name,value){this.headers[name]=value;},
    end(text){this.data=JSON.parse(text);}
  };
}

function withEnvAndFetch(fetchMock, work) {
  const oldFetch = global.fetch;
  const keys = ["GEMINI_API_KEY","SUPABASE_URL","SUPABASE_SERVICE_KEY"];
  const old = Object.fromEntries(keys.map(k => [k,process.env[k]]));
  Object.assign(process.env,{GEMINI_API_KEY:"mock-key",SUPABASE_URL:"https://example.supabase.co",SUPABASE_SERVICE_KEY:"mock-service"});
  global.fetch = fetchMock;
  return Promise.resolve().then(work).finally(() => {
    global.fetch = oldFetch;
    for (const k of keys) old[k] === undefined ? delete process.env[k] : process.env[k] = old[k];
  });
}

const countResponse = n => new Response(null,{status:200,headers:{"content-range":`0-0/${n}`}});
const geminiResponse = () => Response.json({
  candidates:[{content:{parts:[{text:JSON.stringify({
    summary:"The policy terms could change how this scenario affects your goal.",
    questions:["Where can I find the current policy schedule?","Which limits should I check with the insurer?"],
    refusal:false
  })}]}}],
  usageMetadata:{promptTokenCount:141,candidatesTokenCount:58}
});

test("POST calls Gemini, stores exchange and tokens, then reads count back", async () => {
  const calls = [];
  await withEnvAndFetch(async (url, options) => {
    calls.push({url:String(url),method:options.method,body:options.body});
    if (String(url).includes("generativelanguage")) return geminiResponse();
    if (options.method === "HEAD") {
      if (String(url).includes("visitor_id")) return countResponse(0);
      if (String(url).includes("created_at")) return countResponse(1);
      return countResponse(2);
    }
    if (options.method === "POST") return new Response(null,{status:201});
    if (options.method === "PATCH") return new Response(null,{status:204});
    throw Error("Unexpected request");
  }, async () => {
    const res = fakeResponse();
    await handler({method:"POST",headers:{},body:sample},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.data.calculation.gapHigh,50_000);
    assert.equal(res.data.checksCompleted,2);
    assert.equal(res.data.remaining,4);
    assert.equal(res.data.answer.questions.length,2);
  });
  assert.deepEqual(calls.map(c => c.method),["HEAD","HEAD","POST","POST","PATCH","HEAD"]);
  const saved = JSON.parse(calls.find(c => c.method === "POST" && c.url.includes("supabase")).body);
  assert.equal(saved.scenario_input.visitorId,undefined);
  assert.equal(saved.visitor_slot,1);
  const updated = JSON.parse(calls.find(c => c.method === "PATCH").body);
  assert.equal(updated.input_tokens,141);
  assert.equal(updated.output_tokens,58);
});

test("the server enforces the five-request cap before calling Gemini", async () => {
  let calls = 0;
  await withEnvAndFetch(async (_url, options) => {
    calls++;
    assert.equal(options.method,"HEAD");
    return countResponse(5);
  }, async () => {
    const res = fakeResponse();
    await handler({method:"POST",headers:{},body:sample},res);
    assert.equal(res.statusCode,429);
    assert.match(res.data.error,/five scenario checks/);
  });
  assert.equal(calls,1);
});

test("GET count comes from Supabase and invalid submissions make no external call", async () => {
  let calls = 0;
  await withEnvAndFetch(async (_url, options) => {
    calls++;
    assert.equal(options.method,"HEAD");
    return countResponse(7);
  }, async () => {
    const get = fakeResponse();
    await handler({method:"GET",headers:{}},get);
    assert.deepEqual(get.data,{checksCompleted:7});
    const bad = fakeResponse();
    await handler({method:"POST",headers:{},body:{...sample, monthlySaving:0}},bad);
    assert.equal(bad.statusCode,400);
  });
  assert.equal(calls,1);
});
