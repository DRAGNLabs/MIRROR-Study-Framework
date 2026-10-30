"""
Play a few rounds of the fishing game against each model and check whether it
reasons (and returns that reasoning) in the actual user-study scenario.

It mirrors what the server does for an automated test room:
  - system prompt + response prompt from games/game4.json
  - 3 bot fishers (Legacy, Growth, Rogue — same as a 3-user automated test)
    sending their role's initial_request, then enter/exit_request by status
  - each memo is run through the extraction prompt to get allocations, which
    drive status changes and how many fish are in the lake next round

For every round it reports reasoning tokens, whether reasoning items came back,
and whether they include encrypted reasoning, readable summary, or raw text.
Full responses are saved to ./reasoning_game_output/ for inspection.

Usage:
  pip install openai python-dotenv
  python test_reasoning_game.py                                # all models, 3 rounds
  python test_reasoning_game.py --rounds 2 anthropic/claude-sonnet-5.5
  python test_reasoning_game.py --passback content             # send back memo text only
"""

import argparse
import json
import math
import os
import re

from dotenv import load_dotenv
from openai import OpenAI

ROOT = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(ROOT, "backend", ".env"))

# Same models/efforts as test_reasoning_models.py. Kimi K3 supports low/high/max only.
MODELS = {
    "anthropic/claude-sonnet-5.5": "medium",
    "openai/gpt-6-astra": "medium",
    "google/gemini-3.8-flash": "medium",
    "moonshotai/kimi-k3": "low",
}

GAME_FILE = os.path.join(ROOT, "games", "game4.json")
OUT_DIR = os.path.join(ROOT, "reasoning_game_output")
ROLE_IDS = ["1", "2", "5"]  # Legacy, Growth, Rogue
EXTRACTION_MODEL = (os.getenv("OPENAI_EXTRACTION_MODEL") or "").strip() or "openai/gpt-4.1-nano"

client = OpenAI(
    api_key=os.getenv("OPEN_ROUTER_API_KEY"),
    base_url="https://openrouter.ai/api/v1",
)


def fill(template, **values):
    """Same as fillPrompt in gameHandler.js: replaces {{key}} placeholders."""
    return re.sub(r"\{\{(\w+)\}\}", lambda m: str(values.get(m.group(1), m.group(0))), template)


def load_game():
    with open(GAME_FILE) as f:
        game = json.load(f)
    roles = [game["role_prompt"][rid] for rid in ROLE_IDS]
    tons = math.ceil(game["tons_needed_total"] / len(roles))
    return game, roles, tons


def request_text(role, status, prev_status, tons):
    """Same rule as pickRequestMessage in testRunner.js."""
    name = role["name"]
    if status == 0 and prev_status == 0:
        return fill(role["initial_request"], user_name=name, tons=tons)
    is_exit = (prev_status < status and prev_status < 0) or (prev_status > status and prev_status > 0)
    prompt_set = role.get(str(prev_status if is_exit else status)) or {}
    template = prompt_set.get("exit_request" if is_exit else "enter_request") or role["initial_request"]
    return fill(template, user_name=name, tons=tons)


def call_model(model, input_items, effort, use_include=True):
    """Responses API call asking for reasoning; retries without `include` if rejected."""
    kwargs = dict(model=model, input=input_items, reasoning={"effort": effort, "summary": "auto"})
    if use_include:
        kwargs["include"] = ["reasoning.encrypted_content"]
    try:
        return client.responses.create(**kwargs), use_include
    except Exception as e:
        if use_include:
            print(f"    'include' rejected ({type(e).__name__}: {e}); retrying without it")
            return call_model(model, input_items, effort, use_include=False)
        raise


def inspect_reasoning(resp):
    items = [item.model_dump(exclude_none=True) for item in resp.output]
    reasoning = [i for i in items if i.get("type") == "reasoning"]
    summary = " ".join(s.get("text", "") for r in reasoning for s in (r.get("summary") or [])).strip()
    raw = " ".join(c.get("text", "") for r in reasoning for c in (r.get("content") or [])).strip()
    encrypted = [r["encrypted_content"] for r in reasoning if r.get("encrypted_content")]
    usage = resp.usage.model_dump() if resp.usage else {}
    return {
        "items": items,
        "reasoning_items": len(reasoning),
        "reasoning_formats": sorted({r.get("format", "?") for r in reasoning}),
        "reasoning_tokens": (usage.get("output_tokens_details") or {}).get("reasoning_tokens"),
        "encrypted_chars": sum(len(e) for e in encrypted),
        "summary": summary,
        "raw": raw,
        "usage": usage,
    }


def extract_allocations(game, names, memo):
    """Same flat-schema extraction as extractAllocations in gameHandler.js."""
    schema = {
        "type": "object",
        "properties": {n: {"type": "number"} for n in names},
        "required": names,
        "additionalProperties": False,
    }
    resp = client.responses.create(
        model=EXTRACTION_MODEL,
        input=[
            {"role": "system", "content": game["prompts"][0]["extraction_prompt"]},
            {"role": "user", "content": json.dumps({"userNames": names, "llmResponse": memo}, indent=2)},
        ],
        text={"format": {"type": "json_schema", "name": "round_allocations", "schema": schema, "strict": True}},
    )
    parsed = json.loads(resp.output_text)
    return {n: float(parsed[n]) for n in names}


def next_fish(fish_left):
    """Same regrowth rule as gameHandler.js."""
    if fish_left < 5:
        return fish_left
    if fish_left > 50:
        return 100
    return fish_left * 2


def play(model, effort, rounds, passback, game, roles, tons):
    print(f"\n=== {model} (effort={effort}, passback={passback}) ===")
    names = [r["name"] for r in roles]
    status = {n: 0 for n in names}
    prev_status = {n: 0 for n in names}
    fish = 100
    prompts = game["prompts"][0]
    input_items = [{"role": "system", "content": prompts["system_prompt"]}]
    use_include = True
    log = {"model": model, "effort": effort, "passback": passback, "rounds": []}

    for month in range(1, rounds + 1):
        requests = "\n".join(
            f"{r['name']}: {request_text(r, status[r['name']], prev_status[r['name']], tons)}" for r in roles
        )
        response_prompt = fill(prompts["response_prompt"], fish_available=f"{fish:g}", month=month)
        user_msg = f"{response_prompt} \n {requests}"
        input_items.append({"role": "user", "content": user_msg})

        try:
            resp, use_include = call_model(model, input_items, effort, use_include)
        except Exception as e:
            print(f"  month {month}: CALL FAILED: {type(e).__name__}: {e}")
            log["rounds"].append({"month": month, "error": str(e)})
            break

        memo = (resp.output_text or "").strip()
        info = inspect_reasoning(resp)
        print(
            f"  month {month}: fish={fish:<5g} reasoning_tokens={info['reasoning_tokens']!s:<6} "
            f"items={info['reasoning_items']} formats={info['reasoning_formats'] or '-'} "
            f"encrypted={info['encrypted_chars']} chars  summary={len(info['summary'])} chars  "
            f"raw={len(info['raw'])} chars  memo={len(memo)} chars"
        )

        try:
            alloc = extract_allocations(game, names, memo)
        except Exception as e:
            print(f"    extraction failed ({type(e).__name__}: {e}); treating allocations as 0")
            alloc = {n: 0.0 for n in names}
        print(f"    allocations: {alloc}")

        log["rounds"].append({
            "month": month, "fish": fish, "user_message": user_msg, "memo": memo,
            "allocations": alloc, **{k: v for k, v in info.items() if k != "items"},
            "output_items": info["items"],
        })

        # Pass the reply back the way we'd implement it: full output items
        # (reasoning included), or just the memo text like the server does today.
        if passback == "full":
            input_items += info["items"]
        else:
            input_items.append({"role": "assistant", "content": memo})

        fish_left = fish - sum(alloc.values())
        for n in names:
            prev_status[n] = status[n]
            status[n] = status[n] + 1 if alloc[n] >= tons else status[n] - 1
        if fish_left < 5:
            print(f"    lake collapsed (fish_left={fish_left}); stopping")
            break
        fish = next_fish(fish_left)

    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, model.replace("/", "__") + ".json")
    with open(path, "w") as f:
        json.dump(log, f, indent=2, default=str)
    print(f"  saved: {path}")
    return log


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("models", nargs="*", help="model ids (default: all in MODELS)")
    parser.add_argument("--rounds", type=int, default=3)
    parser.add_argument("--passback", choices=["full", "content"], default="full",
                        help="full = send back reasoning items too; content = memo text only")
    args = parser.parse_args()

    if not os.getenv("OPEN_ROUTER_API_KEY"):
        raise SystemExit("OPEN_ROUTER_API_KEY is not set (looked in backend/.env)")

    game, roles, tons = load_game()
    print(f"Players: {', '.join(r['name'] for r in roles)}  |  tons needed each: {tons}  |  extraction model: {EXTRACTION_MODEL}")

    logs = [play(m, MODELS.get(m, "medium"), args.rounds, args.passback, game, roles, tons)
            for m in (args.models or list(MODELS))]

    print("\n=== SUMMARY: reasoning tokens per month (E = encrypted reasoning returned) ===")
    for log in logs:
        cells = []
        for r in log["rounds"]:
            if "error" in r:
                cells.append("ERR")
            else:
                cells.append(f"{r['reasoning_tokens']}{' E' if r['encrypted_chars'] else ''}")
        print(f"{log['model']:32} " + "  |  ".join(cells))


if __name__ == "__main__":
    main()
