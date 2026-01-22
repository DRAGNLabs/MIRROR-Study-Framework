export default function InstructionsModal({ open, onClose, game, role }) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()} 
      >
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>

        <h2>Instructions</h2>

        <p>{game.instructions.overview}</p>

        <h3>Rounds</h3>
        <ul>
          {game.instructions.rounds.map((r, i) => (
            <li key={i}>{r.description}</li>
          ))}
        </ul>

        <h3>Goal</h3>
        <p>{game.instructions.goal}</p>

        {role && (
          <>
            <h3>Your Role: {role.role}</h3>
            <p><strong>Backstory:</strong> {role.backstory}</p>
            <p><strong>Drawbacks:</strong> {role.drawbacks}</p>
          </>
        )}
      </div>
    </div>
  );
}
