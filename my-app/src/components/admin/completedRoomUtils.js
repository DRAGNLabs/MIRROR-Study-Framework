// Reconstructs the exact "town report" text gameHandler.js builds and sends
// to the LLM for a given round (see the replay loop in getLlmText). It's
// never persisted anywhere — only assembled on the fly each time the backend
// calls the model — so this is a read-only reconstruction from data that IS
// persisted (user_status, role, resourceAllocations), for admin review only.
// Uses llm_enter/llm_exit (third-person, what the LLM actually saw), not the
// enter/exit text shown to the user themselves.
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
            userReport = typeof template === "string"
                ? template.replace(/\{\{user_name\}\}/g, name)
                : "";
        }

        const lastAllocation = resourceAllocations?.[round - 1]?.allocationByUserName?.[name]?.fish ?? 0;
        return `${name}: Last month you allocated ${lastAllocation} tons to ${name}. ${userReport}`;
    });

    return lines.join("\n");
}
