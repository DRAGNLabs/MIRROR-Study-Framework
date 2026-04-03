# Two-Call LLM Strategy: Change Summary

**Branch:** `test-prompting`
**Commits:** `582ddf1` through `3488fbb`
**Date:** 2026-02-26

## Problem

The LLM was forced to respond in strict JSON (`response_prompt` demanded a JSON object with `allocationByUserName`, `fish_left`, `assistantMessage`). This distorted the model's natural language behavior — users saw either raw JSON or a placeholder message ("An internal allocation update occurred.") instead of a genuine conversational response from the lake manager. The frontend had to detect JSON-shaped messages and hide them, which was fragile and produced a poor user experience.

## Solution

Split the single LLM call into two:

1. **Call 1 (streamed):** The model responds naturally to fishermen's requests. This is what users see in real time. No format constraints.
2. **Call 2 (non-streamed):** A separate, invisible call extracts structured allocation data (`allocationByUserName`, `fish_left`) from the natural response. This data drives the resource panel and fish math. It is never displayed or saved as a response.

The natural text from call 1 is stored in the DB as `llmResponse` and used in conversation history for subsequent rounds. The structured data from call 2 is stored in `resourceAllocations`.

---

## Files Changed

### 1. `games/game4.json`

**What changed:**
- Rewrote `response_prompt` to remove all JSON format constraints. It now asks the model to respond naturally: state each fisherman's allocation by name, explain reasoning, and state remaining fish.
- Added a new field `extraction_prompt` containing the JSON extraction instructions and schema.

**Why:**
The old `response_prompt` was doing double duty — it had to produce both a user-facing explanation (stuffed into `assistantMessage` inside JSON) and structured data (the JSON itself). This is an awkward ask for a language model. Splitting them lets each prompt do one job well. The `extraction_prompt` is deliberately simple and mechanical — it just reads numbers out of natural text and formats them as JSON.

**Design decisions:**
- The natural `response_prompt` still explicitly instructs the model to "state clearly by name how many tons of fish you are allocating" and to "state how many tons of fish remain." This is intentional — if the model is vague about numbers, call 2 has nothing concrete to extract.
- The `extraction_prompt` uses `role: "system"` in the extraction call so the model treats it as instructions, with the natural response passed as `role: "user"` content to extract from.
- `assistantMessage` was removed from the extraction schema since the natural response itself *is* the message now. No need to duplicate it inside JSON.

---

### 2. `backend/llm.js`

**What changed:**
- Added `callLLM(messages)` — a non-streaming wrapper around `client.responses.create()` that returns `response.output_text`.

**Why:**
The existing `streamLLM` function streams tokens via a callback, which is necessary for call 1 (real-time display to users). Call 2 doesn't need streaming — it's an internal extraction step. A simple request/response call is cleaner and avoids the overhead of event handling.

**Design decisions:**
- Uses the same `client.responses.create()` API and same `OPENAI_MODEL` env var as the streaming call, ensuring consistent model behavior.
- Returns `response.output_text` directly. This is a convenience property on the OpenAI Responses API that concatenates all text output items.

---

### 3. `backend/socket/gameHandler.js`

This file had the most changes across multiple commits. Here's everything that was modified and why.

#### 3a. Import `callLLM`

```js
import { streamLLM, callLLM } from "../llm.js";
```

Self-explanatory — needed for the extraction call.

#### 3b. Added `stripFences(text)` helper

```js
function stripFences(text) {
    if (typeof text !== "string") return "";
    return text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
}
```

**Why:** LLMs frequently wrap JSON output in markdown code fences (`` ```json ... ``` ``) even when told not to. `JSON.parse` chokes on these. `jsonrepair` doesn't strip them either — it's designed for malformed JSON, not markdown wrappers. This helper strips leading/trailing fences before any parse attempt. It also handles `undefined` or non-string input (returns `""`) as a safety measure.

#### 3c. Rewrote the extraction block in `getLlmText`

**Before:** After streaming, the function tried to `JSON.parse(buffer)` directly (the streamed response *was* the JSON). On failure, it used `jsonrepair`. It then extracted `assistantMessage`, `allocationByUserName`, and `fish_left` from the parsed result, computed next-round fish, and saved to DB. It returned `assistantMessage` (or a fallback string).

**After:** The function is now structured in two phases:

1. **Streaming (call 1):** Unchanged. Streams tokens to the UI. The buffer now contains natural language, not JSON.

2. **Extraction (call 2):** After streaming completes, if `getAllocation` is true:
   - Builds a two-message array: `extraction_prompt` as system, `buffer` (natural response) as user content.
   - Calls `callLLM()` (non-streaming).
   - Strips markdown fences via `stripFences()`.
   - Parses JSON. On failure, retries with a fresh `callLLM()` call + `jsonrepair`.
   - Extracts `allocationByUserName` and `fish_left`, computes next-round fish, saves `resourceAllocations`.
   - On any failure, the outer catch sets `fish_amount[round+1] = fish_amount[round]` (carry forward unchanged) and logs the error. The game continues.

**Critical design decision — the outer try/catch:**

The entire extraction block (API call, JSON parsing, fish math, DB writes) is wrapped in a single top-level try/catch. This is deliberate. Before this change, any unhandled exception in the extraction or post-parsing logic would propagate up through `getLlmText` → `getLlmResponse` → `submitUserMessages` → the socket handler, which has no error handling. The socket handler would silently swallow the error, and no `round-complete` or `instructions-complete` events would ever fire. The game would freeze permanently with no error visible to users.

By catching everything and returning `buffer` regardless, the game always advances. The natural response is always saved and displayed. The worst case is that the resource panel doesn't update for one round and fish carries forward unchanged.

**Why the retry calls `callLLM` again instead of reusing the first result:**

If the first `callLLM` throws (API error, not a parse error), there's nothing to parse. The retry makes a fresh API call. If the first call succeeded but the JSON was malformed, the retry gives the model another chance with fresh sampling. This is a pragmatic tradeoff — an extra API call on failure is cheap compared to a frozen game.

#### 3d. Return value change

**Before:** Returned `assistantMessage` (extracted from JSON) or a fallback string.
**After:** Returns `buffer` (the full natural response).

This means `llmResponse` in the DB now stores natural language, and conversation history for subsequent rounds uses natural language. This is the whole point — the model sees its own natural responses in context, not JSON artifacts.

#### 3e. `getLlmResponse` error handling

Wrapped the entire function body in try/catch blocks:

- **Around `getLlmText`:** If the streaming call itself crashes, emit `ai-end` (so the frontend doesn't hang in streaming state) and set buffer to an error message.
- **Around post-processing:** If DB writes, round logic, or `getLlmInstructions` crash, log the error. This prevents the socket handler from silently dying.

Added round-tagged `console.log` statements at each stage:
- `[Round N] Sending X messages to LLM` — confirms conversation history was built
- `[Round N] Starting extraction call...` — confirms streaming completed
- `[Round N] Extraction succeeded, fish_left=X` — confirms extraction worked
- `[Round N] streamLLM threw:` / `Extraction failed:` / `getLlmText crashed:` / `post-processing crashed:` — identifies exactly where failures occur

**Why logging matters here:** The socket handlers in `socketServer.js` have no error handling (`await submitUserMessages(...)` with no try/catch). Any thrown error vanishes silently. Without these logs, a game freeze is undiagnosable — you'd see nothing in the console.

---

### 4. `my-app/src/interaction/Interaction.jsx`

#### 4a. Removed `isJsonLike` display hack

**Before:**
```jsx
const rawText = typeof msg.text === "string" ? msg.text : "";
const isJsonLike =
    rawText.trim().startsWith("{") &&
    rawText.includes("allocationByUserName");
const safeText = isJsonLike
    ? "An internal allocation update occurred."
    : rawText;
```

**After:**
```jsx
const safeText = typeof msg.text === "string" ? msg.text : "";
```

**Why:** With the two-call strategy, `llmResponse` stored in the DB is always natural language. There will never be JSON in the message stream. The detection logic was a band-aid for the single-call approach and is no longer needed.

#### 4b. Added `refreshResourceAllocations()` function

A lightweight async function that fetches only `room.resourceAllocations` from the DB and updates the `resourceHistory` state. It does not touch `messages`, `canSend`, or `hasSentThisRound`.

#### 4c. Changed `round-complete` and `game-complete` handlers

**Before:** Both called `loadRoomState()`.
**After:** Both call `refreshResourceAllocations()`.

**Why — this fixes a race condition that caused the game to freeze:**

The sequence was:
1. Backend emits `round-complete` → frontend calls `loadRoomState()` (starts an async DB fetch)
2. Backend calls `getLlmInstructions()` → emits `receive-message` with the next round's instructions → emits `instructions-complete`
3. Frontend receives `instructions-complete` → sets `canSend = true`
4. Frontend's `loadRoomState()` finishes (the async fetch from step 1) → calls `resetMessages()` → computes `canSend` from DB state → overwrites `canSend` back to `false`

Step 4 overwrites step 3. The user's input is disabled and never re-enabled. The game appears frozen.

This race was timing-dependent. On later rounds, `loadRoomState()` takes longer (more data to process), making the overwrite more likely. This explains the reported behavior: "works for the first couple rounds, then freezes."

The fix is simple: `round-complete` doesn't need to rebuild the full message state. Messages are already maintained in real time by socket events (`receive-message`, `ai-start`, `ai-token`, `ai-end`). The only thing that needs a DB fetch is the resource allocations panel. `refreshResourceAllocations()` does exactly that and nothing else.

`loadRoomState()` is still called on initial component mount (the `useEffect` with `[roomCode]` dependency). This is correct — on first load or page refresh, we need to rebuild everything from the DB. The race condition only occurs when `loadRoomState` is called reactively in response to socket events that also modify the same state.

---

### 5. `my-app/src/admin/AdminInteraction.jsx`

#### 5a. Removed `isJsonLike` display hack

Same change as Interaction.jsx. The admin version checked for `allocationByUserId` (a slightly different key name — likely a vestigial inconsistency), but the logic was identical.

#### 5b. Added `refreshResourceAllocations()` and changed `round-complete` handler

Same pattern as Interaction.jsx. The admin component doesn't have `canSend` state, so it wasn't affected by the freeze bug, but calling `loadRoomState()` on `round-complete` could still cause the instruction message (delivered via socket `receive-message`) to be wiped and re-fetched from DB — a potential source of message flickering or loss if the DB write hasn't completed yet.

---

## Data Flow After Changes

```
1. All users submit messages for the round
2. submitUserMessages() detects all users have submitted
3. getLlmResponse() is called
4. getLlmText(io, roomCode, false, true):
   a. Builds conversation history (system prompt + all prior rounds)
   b. Appends current round: response_prompt (natural) + user messages
   c. Streams response to UI via ai-start / ai-token / ai-end  (CALL 1)
   d. Builds extraction messages: extraction_prompt + streamed response
   e. Calls callLLM() synchronously                              (CALL 2)
   f. Strips markdown fences, parses JSON
   g. Computes fish_amount for next round, saves resourceAllocations
   h. Returns natural text buffer
5. getLlmResponse() saves buffer to llmResponse[round] in DB
6. Emits round-complete → frontend refreshes resource panel only
7. Calls getLlmInstructions() → emits instruction message + instructions-complete
8. Frontend enables user input for next round
```

**What's in the DB:**
- `llmResponse[round]`: Natural language text (what users saw streamed)
- `resourceAllocations[round]`: `{ allocationByUserName: {...}, assistantMessage: <natural text> }`
- `fish_amount[round+1]`: Computed from extracted `fish_left`

**What's in conversation history for subsequent rounds:**
- Previous rounds' `llmResponse` values (natural text), not JSON

---

## Known Limitations / Things to Watch

1. **Extraction is best-effort.** If both extraction attempts fail, fish carries forward unchanged and `resourceAllocations` won't have data for that round. The resource panel will be missing that round's breakdown. The game still advances.

2. **Double API cost per round.** Call 2 adds a non-streamed API call. The extraction prompt + response is relatively short, so cost is modest, but it's nonzero.

3. **Extraction accuracy depends on call 1's specificity.** The natural `response_prompt` tells the model to state allocations "clearly by name" with specific numbers. If the model is vague (e.g., "I'll give you a fair share"), call 2 won't have concrete numbers to extract. In testing this has not been an issue — the prompt is directive enough.

4. **The `stripFences` helper is simple.** It handles the common case (`` ```json\n...\n``` ``) but not exotic variations. `jsonrepair` handles most other malformations.

5. **Socket-level error handling is still absent in `socketServer.js`.** The try/catch additions in `gameHandler.js` prevent silent failures from propagating, but the socket handlers themselves (`start-round`, `submit-round-message`) still have bare `await` calls with no catch. If `getLlmInstructions` throws on `start-round`, that error would also vanish silently. This is a pre-existing issue not addressed in this changeset.
