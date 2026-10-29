import { createPortal } from 'react-dom';
import MessageMarkdown from './MessageMarkdown.jsx'

export default function InstructionsModal({ open, onClose, game, role, timeRemaining=null, formatTime=null }) {
  if (!open) return null;

  const instructions = game?.instructions;
  const overview = typeof instructions === "string" ? instructions : instructions?.content ?? "";
  const firstRound = instructions?.rounds?.[0];

  const modalContent = (
    <div className="modal-backdrop" onClick={onClose}>
      {timeRemaining !== null && formatTime && (
        <div className={`mobile-timer-bar modal-timer ${timeRemaining <= 30 ? 'urgent' : ''}`}>
          ⏱ Time remaining: {formatTime(timeRemaining)}
        </div>
      )}

      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
      >
      <div className="instruction-modal-header">
        <h2>Game Instructions</h2>
        <button type="button" className="instructions-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        </div>
        <div className="modal-content-wrapper">

        {!game ? (
          <p>Loading context…</p>
        ) : (
          <>
            <MessageMarkdown content = {overview || "No overview available."}/>
{/* 
            {firstRound && (
              <>
                <h3>Your task for this round</h3>
                <p>{firstRound.description}</p>
              </>
            )} */}
            <h3>Your task for this round</h3>
            <p>{instructions.task}</p>

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
    </div>
  );

  return createPortal(modalContent, document.body);
}
