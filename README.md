# BridgePlan landing page

A responsive BridgePlan page, extended for Task 4 with one scenario-check feature. The client is plain HTML/CSS/JavaScript. A Vercel function calls Gemini, writes each check to Supabase, and reads back the number of completed checks.

## Preview locally

Open `index.html` directly in a browser, or serve the folder with `python3 -m http.server 8000` and visit `http://localhost:8000`.

## Deploy

Import this repository into Vercel with no build command. Keep the project root at the repository root. See [TASK4_SETUP.md](TASK4_SETUP.md) for the SQL schema and the three server-side environment variables.

## Scope

The hero preview remains illustrative; the form headed “Put one what-if to the test” is the live feature once connected. The A/B/C selector remains an interactive content element. No API keys are in this repository.
