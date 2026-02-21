export default function InstructionsModal({ open, onClose, game, role }) {
  if (!open) return null;

  const instructions = game?.instructions;
  const overview = typeof instructions === "string" ? instructions : instructions?.overview ?? "";
  const firstRound = instructions?.rounds?.[0];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <h2>Conversation context</h2>

        {!game ? (
          <p>Loading context…</p>
        ) : (
          <>
            <p>{overview || "No overview available."}</p>

            {firstRound && (
              <>
                <h3>Your task for this round</h3>
                <p>{firstRound.description}</p>
              </>
            )}

            {role && (
              <>
                <h3>Your role: {role.role}</h3>
                <p><strong>Backstory:</strong> {role.backstory}</p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
