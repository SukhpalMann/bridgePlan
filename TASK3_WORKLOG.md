# Task 3 working notes — BridgePlan

## Landing page plan

- **Product:** BridgePlan: Parent Shock Readiness. A young professional explores a user-chosen hospital bill, funds available quickly, and an assumed insurance payout range. The product shows a possible shortfall and effect on one savings goal, then helps identify a policy or family question to resolve. It does not determine claim eligibility.
- **Audience:** Young Indian professionals who support ageing parents while saving for a personal goal.
- **Sections:** Hero and illustrative interface, problem, how it works, questions from the launch post, limits and minimal inputs, closing call to action.
- **Visual direction:** Warm, calm editorial design; cream background, deep teal, peach accents, serif headlines, restrained product UI. Responsive for mobile and desktop.
- **Task 2 content reused:** The final post's opening question appears in the hero. Its A/B/C question appears as an interactive content element; the insurance boundary is repeated nearby.

## Actual build process

1. User prompt to ChatGPT (Codex): “great. let's get to task 3 now” in the context of the completed Task 1 concept, final Task 2 post, and attached workbook. The assistant read Task 3, generated the initial single-page HTML/CSS/JS and README.
2. Direct code edit after review: changed a privacy-sounding card heading to “Minimal inputs” because Task 4's required Supabase logging would make a broad privacy promise misleading. No additional user prompt was issued for this edit.
3. Structural check: all in-page anchors resolve and IDs are unique. Both the Vercel and GitHub Pages URLs loaded the same page; the desktop screenshot was captured and the A/B/C selector worked. A mobile viewport was not visually checked.

## Stack

Static `index.html` with embedded CSS and a small vanilla JavaScript question selector. No external packages, trackers, API keys, or backend in Task 3. The central product card is an illustrative preview; Task 4 will add a working feature.

## Workbook fields agreed in chat

- Repository URL supplied by the user: https://github.com/SukhpalMann/bridgePlan (not independently opened because browser access to GitHub was denied).
- Live Vercel URL: https://bridgeplan-two.vercel.app/ . Desktop screenshot: `BridgePlan_Task3_Desktop.jpg` (provided separately in the conversation).
- Approved ratings (1–7): visual design 6, persuasion 5, content completeness 6, code quality 6, overall shareability 5.
- Reflection: Direct editing began after the first page draft to correct an overbroad privacy-sounding heading. A nontechnical person could reproduce a similar page with the full product concept, final post, section plan, and style directions; the short user prompt alone relied on shared conversation context.
- One AI generation round followed by one direct code edit. Actual elapsed time was not recorded; do not invent it.
