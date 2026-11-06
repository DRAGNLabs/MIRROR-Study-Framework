import { fillRoleText } from "../interaction/interactionUtils";


export function buildTownReportForRound(users, game, round, resourceAllocations) {
    const rolePrompt = game?.role_prompt;
    if (!rolePrompt || round <= 1) return "";

    const lines = users.map((user) => {
        const name = user.userName || user.username || `User ${user.userId}`;
        const rolePrompts = rolePrompt[user.role];
        const userStatus = user.user_status ?? {};
        const status = userStatus[round] ?? 0;
        const prevStatus = userStatus[round - 1] ?? 0;

        let userReport = "";
        if (rolePrompts) {
            const isExit =
                (prevStatus < status && prevStatus < 0) ||
                (prevStatus > status && prevStatus > 0);
            const promptSet = rolePrompts[isExit ? prevStatus : status];
            const template = promptSet?.[isExit ? "llm_exit" : "llm_enter"];
            userReport = fillRoleText(template, name);
        }

        const lastAllocation = resourceAllocations?.[round - 1]?.allocationByUserName?.[name]?.fish ?? 0;
        return `${name}: Last month you allocated ${lastAllocation} tons to ${name}. ${userReport}`;
    });

    return lines.join("\n");
}

// Which saved prompts to show, in order. The extraction prompt is mostly JSON
// examples, so it's shown as plain text instead of markdown.
export const PROMPT_FIELDS = [
  { key: "system_prompt", label: "System prompt", markdown: true },
  // { key: "instruction_prompt", label: "Instruction prompt", markdown: true },
  { key: "response_prompt", label: "Response prompt", markdown: true },
  { key: "extraction_prompt", label: "Extraction prompt", markdown: false },
];

// Groups rooms by identical prompt snapshots, so a folder can show one set of
// prompts (or flag when its rooms were run with different prompts).
export function groupRoomsByPrompts(rooms) {
  const groups = new Map();
  for (const room of rooms) {
    if (!room.promptSnapshot) continue;
    const key = JSON.stringify(
      PROMPT_FIELDS.map(({ key: field }) => room.promptSnapshot[field] ?? null)
    );
    if (!groups.has(key)) groups.set(key, { snapshot: room.promptSnapshot, roomCodes: [] });
    groups.get(key).roomCodes.push(room.roomCode);
  }
  return [...groups.values()];
}
