import { describe, expect, it } from "vitest";
import {
    COMPENSATION_BY_PARTICIPANT_COUNT,
    rankParticipantsForCompensation,
} from "./compensation.js";

function history(rounds) {
    return rounds.map((allocations, index) => ({
        round: index + 1,
        allocations,
    }));
}

const users = (names) => names.map((userName, index) => ({ userId: index + 1, userName }));

describe("rankParticipantsForCompensation", () => {
    it("pays 3, 2, and 1 dollars for a three-person room", () => {
        const ranked = rankParticipantsForCompensation(
            users(["Casey", "Alex", "Blake"]),
            history([
                { Casey: { fish: 10 }, Alex: { fish: 5 }, Blake: { fish: 1 } },
                { Casey: { fish: 4 }, Alex: { fish: 8 }, Blake: { fish: 2 } },
            ])
        );

        expect(ranked.map((user) => [user.userName, user.place, user.fish, user.payout])).toEqual([
            ["Casey", 1, 14, 3],
            ["Alex", 2, 13, 2],
            ["Blake", 3, 3, 1],
        ]);
    });

    it("uses the four- and five-person tables", () => {
        const four = rankParticipantsForCompensation(
            users(["A", "B", "C", "D"]),
            history([{ A: { fish: 4 }, B: { fish: 3 }, C: { fish: 2 }, D: { fish: 1 } }])
        );
        const five = rankParticipantsForCompensation(
            users(["A", "B", "C", "D", "E"]),
            history([{ A: { fish: 5 }, B: { fish: 4 }, C: { fish: 3 }, D: { fish: 2 }, E: { fish: 1 } }])
        );

        expect(four.map((user) => user.payout)).toEqual(COMPENSATION_BY_PARTICIPANT_COUNT[4]);
        expect(five.map((user) => user.payout)).toEqual(COMPENSATION_BY_PARTICIPANT_COUNT[5]);
    });

    it("breaks equal fish totals alphabetically and records the tie", () => {
        const ranked = rankParticipantsForCompensation(
            users(["Zoe", "Amy"]),
            history([{ Zoe: { fish: 7 }, amy: { fish: 7 } }])
        );

        expect(ranked.map((user) => user.userName)).toEqual(["Amy", "Zoe"]);
        expect(ranked[0].tiedWith).toEqual(["Zoe"]);
        expect(ranked[1].tiedWith).toEqual(["Amy"]);
        expect(ranked[0].payout).toBeNull();
    });
});
