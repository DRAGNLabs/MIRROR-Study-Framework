import React from "react";
import { calculateTotalAllocations } from "./interactionUtils";


function ResourceTotals({ totals, currentUser = null }) {
    return (
        <>
            <div className="resources-section-label">Total (all rounds)</div>
            <ul className="resources-list">
                {Object.entries(totals).map(([userKey, total]) => {
                    const isYou = currentUser && String(userKey) === String(currentUser);
                    return (
                        <li key={userKey} className="resources-row">
                            <div className="resources-row-main">
                                <span className="resources-row-name">User {userKey}</span>
                                {isYou && (
                                    <span className="resources-row-you">You</span>
                                )}
                            </div>
                            <span className="resources-row-fish">{total} fish</span>
                        </li>
                    );
                })}
            </ul>
        </>
    );
}

function ResourceHistory({ resourceHistory }) {
    return (
        <div className="resources-history">
            <div className="resources-section-label">Round breakdown</div>
            <ul className="resources-history-list">
                {resourceHistory.map((entry) => (
                    <li key={entry.round} className="resources-history-item">
                        <span className="resources-history-round">
                            Round {entry.round}
                        </span>
                        <span className="resources-history-summary">
                            {Object.entries(entry.allocations)
                                .map(([userKey, details]) => {
                                    const fishCount = details?.fish ?? 0;
                                    return `${userKey}: ${fishCount}`;
                                })
                                .join(", ")}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/**
 * Main resource panel component
 */
export function ResourcePanel({ 
    resourceHistory, 
    currentUser = null,
    title = "Resource Split (Fish)",
    subtitle = "Per-user allocations by round"
}) {
    const totals = resourceHistory.length > 0 
        ? calculateTotalAllocations(resourceHistory) 
        : {};

    return (
        <aside className="resources-panel" aria-label="Fish resource split">
            <div className="resources-header">
                <div>
                    <h2 className="resources-title">{title}</h2>
                    <p className="resources-subtitle">{subtitle}</p>
                </div>
            </div>

            {resourceHistory.length > 0 ? (
                <>
                    <ResourceTotals totals={totals} currentUser={currentUser} />
                    <ResourceHistory resourceHistory={resourceHistory} />
                </>
            ) : (
                <div className="resources-empty">
                    <p>Fish allocations will appear here after the first round.</p>
                </div>
            )}
        </aside>
    );
}