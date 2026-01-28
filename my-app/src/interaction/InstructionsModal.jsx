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

        <h3>Your Task for Each Round</h3>
        <p>
          {game.instructions.rounds[0].description}
        </p>

        {role && (
          <>
            <h3>Your Role: {role.role}</h3>
            <p><strong>Backstory:</strong> {role.backstory}</p>
            {/* <p><strong>Drawbacks:</strong> {role.drawbacks}</p> */}
          </>
        )}
      </div>
    </div>
  );
}
