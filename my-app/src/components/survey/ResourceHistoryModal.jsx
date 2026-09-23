import ResourcesPanel from "../interaction/ResourcePanel.jsx";
import "../interaction/interaction.css";
import "./survey.css";
import { createPortal } from "react-dom";

// Reuses the same ResourcesPanel the interaction page shows, just wrapped in
// a modal (like ConversationModal does for ChatBox) instead of the flex
// sidebar / mobile-fullscreen-overlay layout it uses there. No timer on the
// survey page, so timeRemaining is always null here.
export default function ResourceHistoryModal({ open, onClose, resourceHistory, currentUserName }) {
  if (!open) return null;

  const modalContent = (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="conversation-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Resource History</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="conversation-modal-chat-box">
          <ResourcesPanel
            resourceHistory={resourceHistory}
            timeRemaining={null}
            formatTime={null}
            currentUserName={currentUserName}
            isAdmin={false}
          />
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
