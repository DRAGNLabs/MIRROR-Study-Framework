"""
Probe whether each model's reasoning comes back through OpenRouter's
Responses API, and whether passing it back works across turns.

For each model it runs a 2-turn test:
  Turn 1: model silently picks a 6-digit number in its reasoning, answers "Ready."
  Turn 2: we pass back turn 1's output items and ask for the number.

It reports:
  - reasoning token count (from usage)
  - whether readable summary text came back
  - whether raw reasoning text came back
  - whether opaque reasoning came back (encrypted_content / signature fields)
  - whether passback was accepted, and whether the model recalled the number

Full JSON of every response is saved to ./reasoning_probe_output/ for inspection.

Usage:
  pip install openai python-dotenv
  python probe_reasoning.py                  # all models
  python probe_reasoning.py moonshotai/kimi-k3   # one model
"""

import json
import os
import re
import sys

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

# Verify these IDs on openrouter.ai/models before running.
# Kimi K3 natively supports low / high / max (no medium).
MODELS = {
    "openai/gpt-6-astra": "medium",
    "anthropic/claude-sonnet-5.5": "medium",
    "google/gemini-3.8-flash": "medium",
    "moonshotai/kimi-k3": "low",
}

TURN1 = (
    "In your private reasoning, choose a random 6-digit number. "
    "Do NOT write the number in your reply. Reply with only the word: Ready."
)
TURN2 = (
    "What was the 6-digit number you chose in your previous turn? "
    "Reply with just the number. If you don't have access to it, say NO ACCESS."
)

OUT_DIR = "reasoning_probe_output"
SIX_DIGITS = re.compile(r"(?<!\d)\d{6}(?!\d)")

client = OpenAI(
    api_key="",
    base_url="https://openrouter.ai/api/v1",
)


def call(model, input_items, effort, use_include=True):
    """Call the Responses API; retry without `include` if it's rejected."""
    kwargs = dict(
        model=model,
        input=input_items,
        reasoning={"effort": effort, "summary": "auto"},
    )
    if use_include:
        kwargs["include"] = ["reasoning.encrypted_content"]
    try:
        return client.responses.create(**kwargs), use_include
    except Exception as e:
        if use_include:
            print(f"    'include' rejected ({type(e).__name__}: {e}); retrying without it")
            return call(model, input_items, effort, use_include=False)
        raise


def find_opaque(obj, path=""):
    """Recursively find non-empty encrypted/signature fields."""
    hits = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            p = f"{path}.{k}" if path else k
            if re.search(r"encrypt|signature", k, re.I) and isinstance(v, str) and v:
                hits.append((p, len(v)))
            else:
                hits += find_opaque(v, p)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            hits += find_opaque(v, f"{path}[{i}]")
    return hits


def inspect(resp):
    items = [item.model_dump(exclude_none=True) for item in resp.output]
    reasoning = [i for i in items if i.get("type") == "reasoning"]

    summary = " ".join(
        s.get("text", "") for r in reasoning for s in (r.get("summary") or [])
    ).strip()
    raw = " ".join(
        c.get("text", "") for r in reasoning for c in (r.get("content") or [])
    ).strip()
    opaque = [h for r in reasoning for h in find_opaque(r)]

    usage = resp.usage.model_dump() if resp.usage else {}
    rtok = (usage.get("output_tokens_details") or {}).get("reasoning_tokens")

    return {
        "items": items,
        "n_reasoning_items": len(reasoning),
        "reasoning_keys": sorted({k for r in reasoning for k in r}),
        "summary": summary,
        "raw": raw,
        "opaque": opaque,
        "reasoning_tokens": rtok,
        "usage": usage,
    }


def probe(model, effort):
    print(f"\n=== {model} (effort={effort}) ===")
    result = {"model": model, "effort": effort}
    turn1_input = [{"role": "user", "content": TURN1}]

    # ---- Turn 1 ----
    try:
        resp1, used_include = call(model, turn1_input, effort)
    except Exception as e:
        print(f"    TURN 1 FAILED: {type(e).__name__}: {e}")
        result["error"] = str(e)
        return result

    print("\n\n")
    print(resp1)
    print("\n\n")
    t1 = inspect(resp1)
    answer1 = (resp1.output_text or "").strip()
    visible = f"{t1['summary']} {t1['raw']}"
    secret = SIX_DIGITS.findall(visible)

    print(f"    include accepted:     {used_include}")
    print(f"    reasoning tokens:     {t1['reasoning_tokens']}")
    print(f"    reasoning items:      {t1['n_reasoning_items']}  keys={t1['reasoning_keys']}")
    print(f"    summary text:         {len(t1['summary'])} chars")
    print(f"    raw reasoning text:   {len(t1['raw'])} chars")
    print(f"    opaque fields:        {t1['opaque'] or 'NONE'}")
    print(f"    turn 1 answer:        {answer1[:80]!r}")
    if secret:
        print(f"    number visible in reasoning text: {secret[-1]}")

    result.update(
        include_accepted=used_include,
        reasoning_tokens=t1["reasoning_tokens"],
        has_summary=bool(t1["summary"]),
        has_raw=bool(t1["raw"]),
        has_opaque=bool(t1["opaque"]),
        number_in_visible_reasoning=secret[-1] if secret else None,
        number_leaked_in_answer=bool(SIX_DIGITS.search(answer1)),
    )

    # ---- Turn 2: pass back turn 1's output items ----
    turn2_input = turn1_input + t1["items"] + [{"role": "user", "content": TURN2}]
    t2 = None
    try:
        resp2, _ = call(model, turn2_input, effort, use_include=used_include)
        print("resp2\n")
        print(resp2)
        t2 = inspect(resp2)
        answer2 = (resp2.output_text or "").strip()
        result["passback_accepted"] = True
    except Exception as e:
        answer2 = ""
        result["passback_accepted"] = False
        result["passback_error"] = str(e)
        print(f"    PASSBACK REJECTED: {type(e).__name__}: {e}")

    if result["passback_accepted"]:
        recalled = SIX_DIGITS.findall(answer2)
        print(f"    turn 2 answer:        {answer2[:80]!r}")
        if not recalled:
            verdict = "no number recalled -> reasoning likely NOT carried over"
        elif secret and recalled[0] == secret[-1]:
            verdict = "recalled the number from visible reasoning -> carried over"
            if t1["summary"] and not t1["raw"] and not t1["opaque"]:
                verdict += " (but only summary was passed back, so recall may come from the summary)"
        elif secret:
            verdict = "recalled a DIFFERENT number -> reasoning likely NOT carried over"
        else:
            verdict = "gave a number not visible to us; consistent with opaque passback, can't verify"
        print(f"    verdict:              {verdict}")
        result.update(recalled=recalled[0] if recalled else None, verdict=verdict)

    os.makedirs(OUT_DIR, exist_ok=True)
    fname = os.path.join(OUT_DIR, model.replace("/", "__") + ".json")
    with open(fname, "w") as f:
        json.dump(
            {"result": result, "turn1": t1, "turn2": t2},
            f, indent=2, default=str,
        )
    print(f"    saved: {fname}")
    return result


def main():
    selected = sys.argv[1:] or list(MODELS)
    results = [probe(m, MODELS.get(m, "medium")) for m in selected]

    print("\n\n=== SUMMARY ===")
    header = f"{'model':32} {'rtok':>6} {'summary':>8} {'raw':>5} {'opaque':>7} {'passback':>9}  recall"
    print(header)
    print("-" * len(header))
    for r in results:
        if "error" in r:
            print(f"{r['model']:32} ERROR: {r['error'][:60]}")
            continue
        yn = lambda b: "yes" if b else "no"
        print(
            f"{r['model']:32} {str(r.get('reasoning_tokens')):>6} "
            f"{yn(r.get('has_summary')):>8} {yn(r.get('has_raw')):>5} "
            f"{yn(r.get('has_opaque')):>7} {yn(r.get('passback_accepted')):>9}  "
            f"{r.get('recalled') or '-'}"
        )


if __name__ == "__main__":
    main()