// Bonus pay by finishing place. Index 0 is 1st place.
export const COMPENSATION_BY_PARTICIPANT_COUNT = {
    3: [3, 2, 1],
    4: [3, 2, 2, 1],
    5: [3, 2, 2, 1, 1],
};

function nameKey(name) {
    return String(name ?? "").trim().toLowerCase();
}

export function totalFishByUserName(resourceHistory) {
    const totals = new Map();
    for (const entry of resourceHistory ?? []) {
        const allocations = entry?.allocations ?? {};
        for (const [name, details] of Object.entries(allocations)) {
            const key = nameKey(name);
            if (!key) continue;
            const fish = Number(details?.fish);
            totals.set(key, (totals.get(key) ?? 0) + (Number.isFinite(fish) ? fish : 0));
        }
    }
    return totals;
}

// Higher total fish ranks first. Equal totals are ordered by name so each
// person still gets one place from the compensation table.
export function rankParticipantsForCompensation(users, resourceHistory) {
    const totals = totalFishByUserName(resourceHistory);
    const payouts = COMPENSATION_BY_PARTICIPANT_COUNT[users.length] ?? null;

    const ranked = [...users].sort((a, b) => {
        const fishDiff =
            (totals.get(nameKey(b.userName)) ?? 0) - (totals.get(nameKey(a.userName)) ?? 0);
        if (fishDiff !== 0) return fishDiff;
        return String(a.userName).localeCompare(String(b.userName), undefined, { sensitivity: "base" });
    });

    return ranked.map((user, index) => {
        const fish = totals.get(nameKey(user.userName)) ?? 0;
        const tiedWith = ranked
            .filter((other, otherIndex) =>
                otherIndex !== index && (totals.get(nameKey(other.userName)) ?? 0) === fish
            )
            .map((other) => other.userName);

        return {
            userId: user.userId,
            userName: user.userName,
            place: index + 1,
            fish,
            payout: payouts ? payouts[index] : null,
            tiedWith,
        };
    });
}

export function placeLabel(place) {
    const mod100 = place % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${place}th`;
    const mod10 = place % 10;
    if (mod10 === 1) return `${place}st`;
    if (mod10 === 2) return `${place}nd`;
    if (mod10 === 3) return `${place}rd`;
    return `${place}th`;
}
