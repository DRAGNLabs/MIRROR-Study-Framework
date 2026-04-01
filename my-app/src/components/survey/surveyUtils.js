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

        // Group scale + optional justification on one page (game4.json order).
        if (q.id === "compensation" && questions[i + 1]?.id === "compensation-explanation") {
            steps.push({ questions: [q, questions[i + 1]] });
            i++;
            continue;
        }
        if (q.id === "negotiation" && questions[i + 1]?.id === "negotiation-explanation") {
            steps.push({ questions: [q, questions[i + 1]] });
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

export function isRequiredQuestionUnanswered(q, answers) {
    if (q.type === "label") return false;
    if (q.optional) return false;
    if (q.type === "sortRank") {
        const val = answers[q.id];
        return !Array.isArray(val) || val.length !== (q.options?.length ?? 0);
    }
    return answers[q.id] == null || answers[q.id] === "";
}

export function displayStepHasUnanswered(step, answers) {
    const questionsInStep = step.questions ?? (step.question ? [step.question] : []);
    return questionsInStep.some(q => isRequiredQuestionUnanswered(q, answers));
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