import { getUser } from "../../services/usersService";

export async function buildConversation(room) {
    const llmInstructions = room.llmInstructions;
    const userMessages = room.userMessages;
    const llmResponses = room.llmResponse;

    const rounds = Object.keys(llmInstructions).sort((a, b) => a - b);
    const messages = [];

    for (const round of rounds) {
        if (llmInstructions[round]) {
            messages.push({
                sender: "llm",
                text: llmInstructions[round]
            });
        }

        const roundMsgs = userMessages[round] || [];
        for (const [uid, text] of roundMsgs) {
            const userData = await getUser(uid);
            messages.push({
                sender: "user",
                userName: userData.userName,
                text
            });
        }

        if (llmResponses[round]) {
            messages.push({
                sender: "llm",
                text: llmResponses[round]
            });
        }
    }

    return messages;
}