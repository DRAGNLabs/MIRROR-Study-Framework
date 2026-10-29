import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  deidentifyCompletedRoom,
  getDeidentificationPreview,
} from "../../services/roomsService";

// Preview + password-confirmed deidentification for one completed room.
// onDone(result) is called after the database has been updated.
export function DeidentifyRoomModal({ roomCode, onClose, onDone }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function loadPreview() {
    setLoading(true);
    setPreview(null);
    setError("");
    setPassword("");
    try {
      setPreview(await getDeidentificationPreview(roomCode));
    } catch (err) {
      setError(err.message || "Can't create preview.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  function close() {
    if (submitting) return;
    onClose();
  }

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [submitting, onClose]);

  async function confirm(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await deidentifyCompletedRoom(
        roomCode,
        password,
        preview.confirmationToken
      );
      setPassword("");
      onDone(result);
    } catch (err) {
      setError(err.message || "Can't deidentify completed room.");
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        className="confirm-modal-card deidentify-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="deidentify-modal-title"
        aria-describedby="deidentify-modal-notice"
      >
        <button
          className="deidentify-modal-close"
          type="button"
          onClick={close}
          disabled={submitting}
          aria-label="Close preview"
        >
          &times;
        </button>
        <h2 className="confirm-modal-title" id="deidentify-modal-title">
          Review deidentification preview — {roomCode}
        </h2>
        <p id="deidentify-modal-notice" className="deidentify-warning">
          This will permanently update the database for this completed room,
          its users, and surveys. No original-name mapping or automatic undo
          is kept. Participant IDs remain, so this is pseudonymization, not a
          guarantee of anonymity.
        </p>
        <p className="confirm-modal-text">
          The automatic scan targets participant names, email addresses,
          formatted phone numbers, and recognizable street-address/location
          patterns. It can miss other identifying details and may replace
          ordinary text that resembles these patterns. Review the preview
          before continuing.
        </p>

        {loading && <p role="status">Preparing preview...</p>}
        {error && (
          <p className="deidentify-error" role="alert">
            {error}
          </p>
        )}
        {preview && (
          <>
            <ul className="deidentify-summary">
              <li>Participants: {preview.summary.participants}</li>
              <li>Participant-name occurrences: {preview.summary.participantNames}</li>
              <li>Email addresses: {preview.summary.emails}</li>
              <li>Phone numbers: {preview.summary.phoneNumbers}</li>
              <li>Location patterns: {preview.summary.locations}</li>
            </ul>
            <details className="deidentify-preview-details">
              <summary>Review transformed room, users, and survey data</summary>
              <pre>{JSON.stringify({
                room: preview.room,
                users: preview.users,
                surveys: preview.surveys,
              }, null, 2)}</pre>
            </details>
            <form onSubmit={confirm}>
              <label className="deidentify-password-label" htmlFor="deidentify-admin-password">
                Re-enter admin password to make this change
              </label>
              <input
                id="deidentify-admin-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={submitting}
              />
              <div className="confirm-modal-actions">
                <button
                  className="btn-secondary-admin"
                  type="button"
                  onClick={close}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  className="deidentify-confirm-button"
                  type="submit"
                  disabled={submitting || !password || loading}
                >
                  {submitting
                    ? "Updating database..."
                    : "Looks good — permanently deidentify"}
                </button>
              </div>
            </form>
          </>
        )}
        {!preview && !loading && (
          <div className="confirm-modal-actions">
            <button className="btn-secondary-admin" type="button" onClick={close}>
              Close
            </button>
            <button className="btn-secondary-admin" type="button" onClick={loadPreview}>
              Retry preview
            </button>
          </div>
        )}
      </section>
    </div>,
    document.body
  );
}

export default DeidentifyRoomModal;
