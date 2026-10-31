import { loadGames } from "./gameLoader.js";
import { loadTestScripts } from "./testScriptLoader.js";
import { getUser, createUser, setUserRole } from "./usersService.js";
import { getRoom, updateUserIds, updateStatus, roomCompleted } from "./roomsService.js";
import { getLlmInstructions, submitUserMessages } from "../socket/gameHandler.js";

const games = loadGames();
const testScripts = loadTestScripts();

// A test script user's message for this round. If the script has fewer rounds than
// the room (or skips this user), they repeat their most recent message.
function scriptedMessage(script, scriptUserId, round) {
    for (let r = round; r >= 1; r--) {
        const entry = (script.rounds?.[r] ?? []).find(([id]) => String(id) === String(scriptUserId));
        if (entry) return entry[1];
    }
    return `Requesting fish for round ${round}.`;
}

// Order users submit in this round: the order the script lists them, then anyone missing
function scriptedOrder(script, round, fakeUsers) {
    const ids = (script.rounds?.[round] ?? []).map(([id]) => String(id));
    return [...fakeUsers].sort((a, b) => {
        const ai = ids.indexOf(a.scriptUserId), bi = ids.indexOf(b.scriptUserId);
        return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
    });
}

// Fills {{user_name}} and {{tons}} (tons each player needs this game) in role text
function fillRoleText(template, userName, tons) {
    if (typeof template !== "string") return "";
    return template
        .replace(/\{\{user_name\}\}/g, userName ?? "")
        .replace(/\{\{tons\}\}/g, tons ?? "");
}

// Same enter/exit rule used everywhere else this status feature shows up
// (gameHandler.js's status-update loop, interactionUtils.js's
// buildStatusHistory): moving further from 0 is an "enter" into the new
// status, moving back toward 0 is an "exit" from the one being left.
async function pickRequestMessage(fakeUser, round, game, tons) {
    const rolePrompts = game.role_prompt?.[fakeUser.role];
    const fallback = `Requesting fish for round ${round}.`;
    if (!rolePrompts) return fallback;

    if (round === 1) {
        return fillRoleText(rolePrompts.initial_request, fakeUser.userName, tons) || fallback;
    }

    // user_status is only known accurately after the previous round's
    // allocation was scored, so re-fetch rather than trust anything cached.
    const freshUser = await getUser(fakeUser.userId);
    const userStatus = freshUser?.user_status ?? {};
    const status = userStatus[round] ?? 0;
    const prevStatus = userStatus[round - 1] ?? 0;

    const isExit =
        (prevStatus < status && prevStatus < 0) ||
        (prevStatus > status && prevStatus > 0);
    const promptSet = rolePrompts[isExit ? prevStatus : status];
    const key = isExit ? "exit_request" : "enter_request";
    const template = promptSet?.[key] ?? rolePrompts.initial_request;
    return fillRoleText(template, fakeUser.userName, tons) || fallback;
}

// Seats `testUserCount` simulated bot users (round-robin across the game's
// roles) and plays the whole game to completion using each role's
// predetermined initial_request / enter_request / exit_request text instead
// of waiting on real participants — same underlying round-progression code
// (getLlmInstructions / submitUserMessages) real players' messages go
// through, so responses, status updates, and resource allocations all get
// generated and persisted exactly as they would for a human game. Meant to
// be called fire-and-forget (not awaited) since a full run can take minutes;
// errors are caught and logged rather than thrown back to the caller.
export async function runAutomatedTest(io, roomCode, testUserCount) {
    try {
        const room = await getRoom(roomCode);
        if (!room) throw new Error(`Room ${roomCode} not found`);

        const game = games.find(g => parseInt(g.id) === room.gameType);
        if (!game) throw new Error(`No game found for gameType ${room.gameType}`);
        if (!game.role_prompt) {
            throw new Error(`Game "${game.title}" has no role_prompt data (initial/enter/exit request text), so it can't be auto-played.`);
        }

        // Rooms created with a test script replay its fixed messages (e.g. a pilot study's)
        // instead of each role's request text, and seat exactly the script's users.
        const script = room.testScript ? testScripts.find((s) => s.id === room.testScript) : null;
        if (room.testScript && !script) throw new Error(`Test script "${room.testScript}" not found in games/test_scripts.`);

        let gameRoles = game.roles ?? [];
        if (gameRoles.length === 0) throw new Error(`Game "${game.title}" has no roles defined.`);

        // Testing 3-player rooms without the Desperate Fisher (role 3), since the LLM
        // tends to favor it: seat Legacy (1), Growth (2), and Rogue (5) instead.
        if (testUserCount === 3) {
            const threePlayerRoleIds = ["1", "2", "3"];
            const picked = threePlayerRoleIds
                .map(id => gameRoles.find(r => String(r?.id) === id))
                .filter(Boolean);
            if (picked.length === threePlayerRoleIds.length) gameRoles = picked;
        }

        console.log(`[Automated test] Room ${roomCode}: seating ${testUserCount} bot users...`);

        const usedNames = new Set();
        const fakeUsers = [];
        if (script) {
            for (const scriptUser of script.users ?? []) {
                const created = await createUser(scriptUser.name, roomCode);
                if (scriptUser.role != null) await setUserRole(created.userId, scriptUser.role);
                fakeUsers.push({ userId: created.userId, userName: scriptUser.name, role: scriptUser.role, scriptUserId: String(scriptUser.id) });
            }
        }
        for (let i = 0; !script && i < testUserCount; i++) {
            const roleObj = gameRoles[i % gameRoles.length];
            const roleId = roleObj?.id ?? roleObj?.role;
            let userName = roleObj?.role || `Test Bot ${i + 1}`;
            if (usedNames.has(userName)) {
                userName = `${userName} (${i + 1})`;
            }
            usedNames.add(userName);

            const created = await createUser(userName, roomCode);
            await setUserRole(created.userId, roleId);
            fakeUsers.push({ userId: created.userId, userName, role: roleId });
        }

        // also works out tons_needed now that the number of players is known
        const { tonsNeeded } = await updateUserIds(fakeUsers.map(u => u.userId), roomCode);
        // No real admin/participants walking this through waiting/instructions.
        await updateStatus("interaction", roomCode);

        const numRounds = room.numRounds;

        // Round 1 has no natural trigger otherwise (normally the admin's
        // "start round" click). Every later round is kicked off automatically
        // by submitUserMessages -> getLlmResponse once this round's last bot
        // "sends" their message — the exact same cascade real users' messages
        // already go through.
        await getLlmInstructions(io, roomCode, 1);

        for (let round = 1; round <= numRounds; round++) {
            const currentRoom = await getRoom(roomCode);
            if (!currentRoom || currentRoom.completed || !currentRoom.llmInstructions?.[round]) {
                console.log(`[Automated test] Room ${roomCode}: game ended early before round ${round} (e.g. fish dropped below 5 tons).`);
                break;
            }

            console.log(`[Automated test] Room ${roomCode}: round ${round}, submitting ${fakeUsers.length} bot messages...`);
            // Sequential, not Promise.all — submitUserMessages decides "was
            // that the last submission" from a fresh DB read each time, and
            // concurrent calls racing that read is exactly the kind of bug
            // this whole feature set has already had to fix elsewhere.
            const roundUsers = script ? scriptedOrder(script, round, fakeUsers) : fakeUsers;
            for (const fakeUser of roundUsers) {
                const text = script
                    ? scriptedMessage(script, fakeUser.scriptUserId, round)
                    : await pickRequestMessage(fakeUser, round, game, tonsNeeded);
                await submitUserMessages(io, roomCode, fakeUser.userId, fakeUser.userName, text);
            }
        }

        // No human survey to wait on — mark it completed directly so it
        // shows up on the admin's Completed Rooms page right away.
        await roomCompleted(roomCode);
        console.log(`[Automated test] Room ${roomCode}: finished and marked completed.`);
    } catch (err) {
        console.error(`[Automated test] Room ${roomCode} failed:`, err);
    }
}
