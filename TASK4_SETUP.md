# Task 4: Connect the BridgePlan scenario check

The landing page is still a static `index.html`. Its form calls `/api/scenario` on the same Vercel deployment. That Node.js function calculates the numeric range, asks Gemini for a short explanation and two questions, records the request and displayed answer in Supabase, and returns a Supabase-backed count to the page.

## One-time setup

1. Create a Supabase project. Open its SQL Editor and run `supabase/schema.sql`. The table is `public.bridgeplan_runs`; anonymous and authenticated roles have no table access. Only the server uses the service-role key.
2. Create a Gemini API key in Google AI Studio. **Do not paste it into this chat, the HTML, a screenshot, or GitHub.**
3. In the existing Vercel project, add these Environment Variables for Production (and Preview if desired):
   - `GEMINI_API_KEY`: your Google AI Studio key
   - `SUPABASE_URL`: the Supabase project URL
   - `SUPABASE_SERVICE_KEY`: the **legacy service_role key** from Supabase's API Keys page. It must remain server-side.
4. Push `index.html`, `api/scenario.js`, `lib/scenario-core.mjs`, `package.json`, and `supabase/schema.sql` to the root of the existing `bridgePlan` GitHub repository. Redeploy the Vercel project from that repository. No build command or framework is needed.
5. Open the live Vercel URL, verify the usage count appears, then run a scenario. The page should show a numeric range, a possible goal delay, Gemini's questions, and an increased count.

The environment variable names are safe to include in the workbook. Capture the Vercel Environment Variables **with their values hidden**. Search the GitHub repository for the Gemini key prefix specified in the assignment and confirm no key occurs in code. Never upload or submit screenshots that show secret values.

## Feature specification for the worksheet

- **Name:** Hospital scenario check.
- **Promise:** Test a user-chosen hospital bill against accessible funds and an assumed insurer payout range, see the possible effect on one savings goal, and get questions to resolve uncertainty.
- **Inputs:** Whole-rupee amounts for bill, non-goal family funds, payout range or unknown, goal target, current goal savings, planned monthly saving; one fixed question focus.
- **Outputs:** A deterministic range of amounts still to find after the *assumed* payout and listed funds; possible months added to one goal under a zero-return planning assumption; a short Gemini explanation and two questions.
- **Supabase read-back:** The exact number of completed scenario checks from `bridgeplan_runs` is visible beside the form and updates after submission.
- **Model:** `gemini-2.5-flash-lite`. `generationConfig.maxOutputTokens` is 300.
- **Cap:** Five requests per browser-generated visitor ID, backed by a count and a unique database slot. A global rolling 24-hour cap of 200 requests also limits demo usage. Clearing browser storage changes the visitor ID; this is a demo limit, not strong identity verification.
- **Privacy:** No names, diagnoses, bank credentials, or free-text medical details are requested. Supabase stores the numeric scenario, pseudonymous visitor ID, calculated result, displayed model answer, status, and token counts.

## Calculation boundary

The page calls the gap `max(0, bill - assumed payout - other family funds)`. It is **not** a hospital deposit or a claim prediction. A goal delay compares `ceil((target - saved + gap) / monthly saving)` with `ceil((target - saved) / monthly saving)`. It assumes the gap is made up from money that would otherwise go toward the goal and assumes zero return. The form keeps other family funds separate from the goal savings balance.

The server validates numeric bounds, places only structured flags in the Gemini prompt, rejects unsafe or malformed AI prose before display, and renders all numbers from code. A hidden API test intent for a policy choice or medical decision exercises the prompt's explicit refusal rule; the visible form offers only ordinary question categories.

## Evidence to collect after connection

1. Run at least five checks with varying input values so the Supabase table has five or more rows. Screenshot the Table Editor with secrets and unrelated data hidden.
2. Record one typical input/output and one edge case (for example, unknown payout or an advice-seeking adversarial intent) in the workbook. Use actual live output, not invented transcripts.
3. In Supabase SQL Editor, run:

```sql
select count(*) filter (where status = 'completed') as completed_checks,
       round(avg(input_tokens) filter (where status = 'completed'), 1) as avg_input_tokens,
       round(avg(output_tokens) filter (where status = 'completed'), 1) as avg_output_tokens
from public.bridgeplan_runs;
```

4. Rate the live feature only after testing it on Vercel. The reflection should distinguish a model wording issue from an integration issue actually observed.

## Local checks

`npm test` checks the calculation, validation, cap and database read-back with mocked external services. These tests do **not** prove that your real Gemini key, Supabase project, or Vercel environment is connected.
