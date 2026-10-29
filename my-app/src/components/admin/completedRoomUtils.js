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
