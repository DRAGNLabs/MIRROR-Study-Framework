import FishPerRoundChart from "./FishPerRoundChart";

export default function ResourcesPanel({ 
    resourceHistory, 
    timeRemaining, 
    formatTime, 
    currentUserName = null,
    isAdmin = false 
}) {
    const renderTotalAllocations = () => {
        const totals = {};
        resourceHistory.forEach(({ allocations }) => {
            Object.entries(allocations).forEach(([identifier, details]) => {
                totals[identifier] = (totals[identifier] ?? 0) + (details?.fish ?? 0);
            });
        });

        return (
            <>
                <div className="resources-section-label">Total (all rounds)</div>
                <ul className="resources-list">
                    {Object.entries(totals).map(([identifier, total]) => {
                        const isYou = !isAdmin && String(identifier) === String(currentUserName);
                        return (
                            <li key={identifier} className="resources-row">
                                <div className="resources-row-main">
                                    <span className="resources-row-name">
                                        {isAdmin ? `User ${identifier}` : `User ${identifier}`}
                                    </span>
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
    };

    const renderRoundBreakdown = () => (
        <div className="resources-history">
            <div className="resources-section-label">Round breakdown</div>
            <ul className="resources-history-list">
                {resourceHistory.map((entry) => (
                    <li key={entry.round} className="resources-history-item">
                        <span className="resources-history-round">Round {entry.round}</span>
                        <span className="resources-history-summary">
                            {Object.entries(entry.allocations)
                                .map(([identifier, details]) => {
                                    const fishCount = details?.fish ?? 0;
                                    return `${identifier}: ${fishCount}`;
                                })
                                .join(", ")}
                        </span>
                    </li>
                ))}
            </ul>
            <FishPerRoundChart resourceHistory={resourceHistory} playerKey="userName" dark={false} />
        </div>
    );

    return (
        <aside 
            className={isAdmin ? "admin-resources-panel" : "resources-panel"} 
            aria-label="Fish resource split"
        >
            {timeRemaining !== null && (
                <div className={`timer-warning ${timeRemaining <= 30 ? 'urgent' : ''}`}>
                    ⏱ Time remaining: {formatTime(timeRemaining)}
                </div>
            )}
            
            <div className="resources-header">
                <div>
                    <h2 className="resources-title">Resource Split (Fish)</h2>
                    <p className="resources-subtitle">
                        {isAdmin ? "Per-user allocations by round" : "How fish are divided this game"}
                    </p>
                </div>
            </div>

            {resourceHistory.length > 0 ? (
                <>
                    {renderTotalAllocations()}
                    {renderRoundBreakdown()}
                </>
            ) : (
                <div className="resources-empty">
                    <p>Fish allocations will appear here after the first round.</p>
                </div>
            )}
        </aside>
    );
}