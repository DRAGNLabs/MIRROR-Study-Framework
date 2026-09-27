import { createPortal } from 'react-dom';

// this is for the user to be able to look at their status history
export default function StatusHistoryModal({ open, onClose, history = [] }) {
  if (!open) return null;

  const modalContent = (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="instruction-modal-header">
          <h2>My Status</h2>
          <button type="button" className="instructions-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-content-wrapper">
          {history.length === 0 ? (
            <p>Nothing has changed yet — check back after a round or two.</p>
          ) : (
            <ul className="status-history-list">
              {history.slice().reverse().map((entry) => (
                <li
                  key={entry.round}
                  className={`status-history-item ${entry.good ? 'status-history-item--good' : 'status-history-item--bad'}`}
                >
                  <div className="status-history-item-header">
                    <span className="status-history-round">Round {entry.round}</span>
                    <span className="status-history-badge">{entry.good ? 'Good news' : 'Bad news'}</span>
                  </div>
                  <p className="status-history-message">{entry.message}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
