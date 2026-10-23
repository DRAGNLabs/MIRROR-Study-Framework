import { createPortal } from 'react-dom';

// this is shown to a user at the start of each round when their status changes
export default function StatusUpdateModal({ open, onClose, update }) {
  if (!open || !update) return null;

  const { message, good } = update;

  const modalContent = (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal-card status-update-card ${good ? 'status-update-card--good' : 'status-update-card--bad'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="instruction-modal-header">
          <h2>{good ? 'Good News' : 'Bad News'}</h2>
          <button type="button" className="instructions-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-content-wrapper">
          <p>{message}</p>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
