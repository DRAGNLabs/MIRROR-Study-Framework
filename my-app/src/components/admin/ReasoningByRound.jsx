import MessageMarkdown from "../interaction/MessageMarkdown.jsx";

// Per-round reasoning saved from the model (room.llmReasoning): token counts in a
// table, then each round's readable reasoning (a summary or raw text, depending
// on the model) in a collapsible box.
export function ReasoningByRound({ llmReasoning, passReasoning }) {
  const rounds = Object.keys(llmReasoning ?? {})
    .map(Number)
    .filter((r) => Number.isInteger(r))
    .sort((a, b) => a - b);
  if (rounds.length === 0) return null;

  const totalTokens = rounds.reduce(
    (sum, r) => sum + (Number(llmReasoning[r]?.reasoningTokens) || 0),
    0
  );

  return (
    <div className="room-display" style={{ marginTop: "1.5rem" }}>
      <h2 className="room-section-title">Reasoning by Round</h2>
      <p className="room-section-subtitle">
        {passReasoning
          ? "Each round's reasoning was passed back to the model in later rounds."
          : "Reasoning was saved but not passed back to the model (it only saw earlier memos)."}
      </p>

      <div className="completed-room-table-wrap completed-room-table-wrap--scroll">
        <table className="completed-room-table">
          <thead>
            <tr>
              <th>Round</th>
              <th>Reasoning tokens</th>
              <th>Encrypted reasoning</th>
              <th>Readable reasoning</th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((r) => {
              const entry = llmReasoning[r] ?? {};
              return (
                <tr key={r}>
                  <td className="completed-room-table-row-label">Round {r}</td>
                  <td>{entry.reasoningTokens ?? 0}</td>
                  <td>{entry.hasEncrypted ? "Yes" : "No"}</td>
                  <td>{entry.reasoningText ? `${entry.reasoningText.length} chars` : "None"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="completed-room-table-total-row">
              <td className="completed-room-table-row-label">Total</td>
              <td>{totalTokens}</td>
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="prompt-snapshot reasoning-rounds">
        {rounds.map((r) => {
          const text = llmReasoning[r]?.reasoningText;
          return (
            <details key={r} className="prompt-snapshot-item">
              <summary>Round {r} reasoning</summary>
              <div className="prompt-snapshot-body">
                {text ? (
                  <MessageMarkdown content={text} />
                ) : (
                  <p className="room-section-subtitle">
                    No readable reasoning returned this round
                    {llmReasoning[r]?.hasEncrypted ? " (encrypted only)." : "."}
                  </p>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

export default ReasoningByRound;
