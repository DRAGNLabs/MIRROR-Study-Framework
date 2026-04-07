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

export function buildDisplaySteps(questions) {
    const steps = [];
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];

        // Group specific survey questions onto shared pages:
        // - compensation-explanation (Q6) + negotiation (Q7)
        // - negotiation-explanation (Q8) + interaction-explanation (Q9)
        if (q.id === "compensation-explanation" && questions[i + 1]?.id === "negotiation") {
            // Show the main satisfaction question first, then the justification textbox
            steps.push({ questions: [questions[i + 1], q] });
            i++;
            continue;
        }
        if (q.id === "negotiation-explanation" && questions[i + 1]?.id === "interaction-explanation") {
            // Show the interaction explanation before its justification textbox
            steps.push({ questions: [questions[i + 1], q] });
            i++;
            continue;
        }

        if (q.type === "label" && questions[i + 1]?.type === "scale") {
            steps.push({ sectionLabel: q, questions: [questions[i + 1]] });
            i++;
        } else if (q.type !== "label") {
            steps.push({ questions: [q] });
        }
    }
    return steps;
}

export function formatAnswer(q, answers) {
    const val = answers[q.id];
    if (val == null || val === "") return "(No response)";
    if (q.type === "select") return String(val);
    if (q.type === "scale") return String(val);
    if (q.type === "sortRank" && Array.isArray(val)) {
        return val.map((opt, i) => `${i + 1}. ${opt}`).join(", ");
    }
    return String(val);
}