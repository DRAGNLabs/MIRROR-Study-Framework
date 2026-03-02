import { useMemo } from "react";

function hashStringToIndex(str, mod) {
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
        hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return mod > 0 ? hash % mod : 0;
}

const DEFAULT_COLORS = [
    "#9ec5ff",
    "#b9e59f",
    "#f3a6a6",
    "#a7e4f5",
    "#c5b3f5",
    "#ffd5a3",
    "#bcd4ff",
    "#f2b0b0",
    "#c7e8a8",
    "#d2c0f2"
];

export default function FishDistributionBar({
    allocations,
    totalFish,
    currentUserKey,
    userLabels
}) {
    const segments = useMemo(() => {
        const entries = Object.entries(allocations || {});
        if (!entries.length || !totalFish || totalFish <= 0) {
            return [];
        }
        return entries.map(([key, details]) => {
            const fish = details?.fish ?? 0;
            const percentage = totalFish > 0 ? (fish / totalFish) * 100 : 0;
            const colorIndex = hashStringToIndex(String(key), DEFAULT_COLORS.length);
            const color = DEFAULT_COLORS[colorIndex];
            const label =
                (userLabels && userLabels[key]) ||
                (currentUserKey && String(key) === String(currentUserKey)
                    ? "You"
                    : key);
            return {
                key,
                fish,
                percentage,
                color,
                label,
                isCurrentUser: currentUserKey && String(key) === String(currentUserKey)
            };
        });
    }, [allocations, totalFish, currentUserKey, userLabels]);

    if (!segments.length) {
        return (
            <div className="fish-bar-track fish-bar-track--empty" aria-label="Fish distribution bar" />
        );
    }

    return (
        <div className="fish-bar" aria-label="Latest round fish distribution between users">
            <div className="fish-bar-track">
                {segments.map((segment) => (
                    <div
                        key={segment.key}
                        className={
                            "fish-bar-segment" +
                            (segment.isCurrentUser ? " fish-bar-segment--you" : "")
                        }
                        style={{
                            width: `${segment.percentage}%`,
                            backgroundColor: segment.color
                        }}
                        title={`${segment.label}: ${segment.fish} fish (${segment.percentage.toFixed(
                            1
                        )}%)`}
                    >
                        {segment.percentage > 12 && (
                            <span className="fish-bar-segment-label">
                                {segment.label}: {segment.fish}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

