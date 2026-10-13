import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { setRoomFolder } from "../../services/roomsService";
import { createFolder, updateFolder, deleteFolder } from "../../services/foldersService";
import games from "../../gameLoader";

function formatDate(value) {
  if (value == null || value === "") return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function gameTitle(gameType) {
  const game = games.find((g) => parseInt(g.id) == gameType);
  return game ? game.title : "Unknown Game";
}

// Counts occurrences of each value, e.g. { "openai/gpt-4.1-mini": 2, ... }
function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function formatCounts(counts) {
  return Object.entries(counts)
    .map(([key, n]) => (n > 1 ? `${key} (×${n})` : key))
    .join(", ");
}

// Auto-derived metadata shown alongside the researcher's own description.
function folderSummary(rooms) {
  if (rooms.length === 0) return null;
  const times = rooms
    .map((r) => new Date(r.createdAt).getTime())
    .filter((t) => !Number.isNaN(t));
  return {
    models: formatCounts(countBy(rooms, (r) => r.modelType || "Unknown")),
    games: formatCounts(countBy(rooms, (r) => gameTitle(r.gameType))),
    players: formatCounts(
      countBy(rooms, (r) => `${Array.isArray(r.userIds) ? r.userIds.length : 0} users`)
    ),
    testCount: rooms.filter((r) => r.isTest).length,
    firstRun: times.length ? Math.min(...times) : null,
    lastRun: times.length ? Math.max(...times) : null,
  };
}

// True when a folder has rooms and every one of them is an automated test.
function isAllTestFolder(rooms) {
  return rooms.length > 0 && rooms.every((r) => r.isTest);
}

function TestFolderMarker() {
  return (
    <span className="folder-test-marker" title="All rooms in this folder are automated tests">
      🤖
    </span>
  );
}

function RoomCard({ room, users, folders, onView, onDelete, onMove }) {
  return (
    <div className="room-display">
      <div className="room-display-header">
        <span className="room-code-badge">{room.roomCode}</span>
        <span
          className="room-created-at"
          title={room.createdAt != null ? String(room.createdAt) : ""}
        >
          {formatDate(room.createdAt)}
        </span>
      </div>

      <div className="room-meta">
        {room.isTest && (
          <span className="meta-item test-mode-badge">Automated Test</span>
        )}
        <span className="meta-item"><strong>{gameTitle(room.gameType)}</strong></span>
        <span className="meta-item">
          Users: {Array.isArray(users) ? users.join(", ") : "No users"}
        </span>
        <span className="meta-item">Model used: {room.modelType}</span>
      </div>

      <label className="folder-move">
        <span>Folder</span>
        <select
          className="model-select-input"
          value={room.folderId ?? ""}
          onChange={(e) => onMove(room, e.target.value === "" ? null : Number(e.target.value))}
        >
          <option value="">No folder</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </label>

      <div className="room-actions">
        <button className="btn-primary-admin" onClick={() => onView(room)}>View</button>
        <button className="btn-secondary-admin" onClick={() => onDelete(room)}>Delete</button>
      </div>
    </div>
  );
}

// Modal for creating a folder or editing an existing one's name/description.
// When creating, unfiled rooms can be ticked to move them in right away.
function FolderFormModal({ folder, unfiledRooms, onCancel, onSave }) {
  const [name, setName] = useState(folder?.name ?? "");
  const [description, setDescription] = useState(folder?.description ?? "");
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const isNew = !folder;

  function toggle(roomCode) {
    setSelected((prev) =>
      prev.includes(roomCode) ? prev.filter((c) => c !== roomCode) : [...prev, roomCode]
    );
  }

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description, roomCodes: selected });
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="modal-backdrop">
      <div className="confirm-modal-card folder-modal-card">
        <h3 className="confirm-modal-title">{isNew ? "New folder" : "Edit folder"}</h3>

        <label className="folder-field">
          <span>Name</span>
          <input
            className="folder-text-input"
            value={name}
            placeholder="e.g. Version 1"
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </label>

        <label className="folder-field">
          <span>Description / what changed</span>
          <textarea
            className="folder-text-input folder-textarea"
            value={description}
            placeholder="e.g. Every model once, 3 bot users (same roles). Run before the fish_left fix was merged."
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
          />
        </label>

        {isNew && unfiledRooms.length > 0 && (
          <div className="folder-field">
            <span>Add existing rooms</span>
            <div className="folder-room-picker">
              {unfiledRooms.map((room) => (
                <label key={room.roomCode} className="custom-checkbox folder-room-option">
                  <input
                    type="checkbox"
                    checked={selected.includes(room.roomCode)}
                    onChange={() => toggle(room.roomCode)}
                  />
                  <span className="checkbox-mark" />
                  <span className="folder-room-option-text">
                    <span className="folder-room-option-code">
                      {room.roomCode}
                      {room.isTest && <span className="folder-room-option-tag">🤖 Test</span>}
                    </span>
                    <span className="folder-room-option-meta">
                      {room.modelType} · {formatDate(room.createdAt)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <button
              type="button"
              className="folder-link-button"
              onClick={() =>
                setSelected(
                  selected.length === unfiledRooms.length ? [] : unfiledRooms.map((r) => r.roomCode)
                )
              }
            >
              {selected.length === unfiledRooms.length ? "Clear all" : "Select all"}
            </button>
          </div>
        )}

        <div className="confirm-modal-actions">
          <button className="btn-secondary-admin" onClick={onCancel}>Cancel</button>
          <button className="btn-primary-admin" onClick={submit} disabled={!name.trim() || saving}>
            {isNew ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function CompletedRooms({
  completedRoomList,
  setCompletedRoomList,
  folders,
  setFolders,
  roomUsers,
  openFolderId,
  setOpenFolderId,
  onView,
  onDelete,
}) {
  // null = closed, "new" = creating, otherwise the folder being edited
  const [folderForm, setFolderForm] = useState(null);
  const [folderPendingDelete, setFolderPendingDelete] = useState(null);

  const openFolder = folders.find((f) => f.id === openFolderId) ?? null;

  // If the open folder disappears (deleted), fall back to the top level.
  useEffect(() => {
    if (openFolderId != null && folders.length > 0 && !openFolder) {
      setOpenFolderId(null);
    }
  }, [openFolderId, folders, openFolder, setOpenFolderId]);

  const roomsByFolder = useMemo(() => {
    const map = {};
    for (const room of completedRoomList) {
      const key = room.folderId ?? "unfiled";
      if (!map[key]) map[key] = [];
      map[key].push(room);
    }
    return map;
  }, [completedRoomList]);

  const unfiledRooms = roomsByFolder.unfiled ?? [];

  async function moveRoom(room, folderId) {
    try {
      await setRoomFolder(room.roomCode, folderId);
      setCompletedRoomList((prev) =>
        prev.map((r) => (r.roomCode === room.roomCode ? { ...r, folderId } : r))
      );
    } catch (error) {
      console.error("Error moving room:", error);
    }
  }

  async function saveFolder({ name, description, roomCodes }) {
    try {
      if (folderForm === "new") {
        const folder = await createFolder(name, description, roomCodes);
        setFolders((prev) => [folder, ...prev]);
        if (roomCodes.length > 0) {
          setCompletedRoomList((prev) =>
            prev.map((r) => (roomCodes.includes(r.roomCode) ? { ...r, folderId: folder.id } : r))
          );
        }
      } else {
        const updated = await updateFolder(folderForm.id, { name, description });
        setFolders((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      }
      setFolderForm(null);
    } catch (error) {
      console.error("Error saving folder:", error);
    }
  }

  async function confirmDeleteFolder() {
    const folder = folderPendingDelete;
    try {
      await deleteFolder(folder.id);
      setFolders((prev) => prev.filter((f) => f.id !== folder.id));
      setCompletedRoomList((prev) =>
        prev.map((r) => (r.folderId === folder.id ? { ...r, folderId: null } : r))
      );
      setOpenFolderId(null);
    } catch (error) {
      console.error("Error deleting folder:", error);
    }
    setFolderPendingDelete(null);
  }

  function renderRooms(rooms, emptyText) {
    return (
      <div className="rooms-container">
        {rooms.length > 0 ? (
          rooms.map((room) => (
            <RoomCard
              key={room.roomCode}
              room={room}
              users={roomUsers?.[room.roomCode]}
              folders={folders}
              onView={onView}
              onDelete={onDelete}
              onMove={moveRoom}
            />
          ))
        ) : (
          <p className="rooms-section-subtitle">{emptyText}</p>
        )}
      </div>
    );
  }

  const modals = (
    <>
      {folderForm && (
        <FolderFormModal
          folder={folderForm === "new" ? null : folderForm}
          unfiledRooms={unfiledRooms}
          onCancel={() => setFolderForm(null)}
          onSave={saveFolder}
        />
      )}
      {folderPendingDelete && createPortal(
        <div className="modal-backdrop">
          <div className="confirm-modal-card">
            <h3 className="confirm-modal-title">Delete folder?</h3>
            <p className="confirm-modal-text">
              Delete folder <strong>{folderPendingDelete.name}</strong>?
            </p>
            <p className="confirm-modal-subtext">
              The rooms inside are kept and moved back to Unfiled.
            </p>
            <div className="confirm-modal-actions">
              <button className="btn-secondary-admin" onClick={() => setFolderPendingDelete(null)}>
                Cancel
              </button>
              <button className="btn-danger-admin" onClick={confirmDeleteFolder}>
                Delete folder
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );

  if (openFolder) {
    const rooms = roomsByFolder[openFolder.id] ?? [];
    const summary = folderSummary(rooms);
    return (
      <div className="rooms-grid">
        <button className="btn-secondary-admin completed-room-back" onClick={() => setOpenFolderId(null)}>
          Back to folders
        </button>

        <div className="room-display folder-detail">
          <div className="folder-detail-header">
            <h2 className="rooms-section-title folder-title">
              {openFolder.name}
              {isAllTestFolder(rooms) && <TestFolderMarker />}
            </h2>
            <div className="folder-detail-actions">
              <button className="btn-secondary-admin" onClick={() => setFolderForm(openFolder)}>Edit</button>
              <button className="btn-danger-admin" onClick={() => setFolderPendingDelete(openFolder)}>Delete</button>
            </div>
          </div>

          <p className="folder-description">
            {openFolder.description?.trim() ? openFolder.description : "No description yet — click Edit to add notes on what changed."}
          </p>

          <dl className="folder-summary">
            <dt>Created</dt><dd>{formatDate(openFolder.createdAt)}</dd>
            <dt>Rooms</dt><dd>{rooms.length}{summary ? ` (${summary.testCount} automated)` : ""}</dd>
            {summary && (
              <>
                <dt>Runs</dt><dd>{formatDate(summary.firstRun)} – {formatDate(summary.lastRun)}</dd>
                <dt>Models</dt><dd>{summary.models}</dd>
                <dt>Games</dt><dd>{summary.games}</dd>
                <dt>Players</dt><dd>{summary.players}</dd>
              </>
            )}
          </dl>
        </div>

        <h3 className="rooms-section-title folder-section-heading">Rooms in this folder</h3>
        {renderRooms(rooms, "No rooms in this folder yet. Use the Folder dropdown on a room to move it here.")}
        {modals}
      </div>
    );
  }

  return (
    <div className="rooms-grid">
      <div className="folder-section-top">
        <div>
          <h2 className="rooms-section-title">Completed Rooms</h2>
          <p className="rooms-section-subtitle">Group runs into folders to keep track of what changed between them.</p>
        </div>
        <button className="btn-primary-admin" onClick={() => setFolderForm("new")}>New folder</button>
      </div>

      {folders.length > 0 && (
        <div className="rooms-container folder-grid">
          {folders.map((folder) => {
            const rooms = roomsByFolder[folder.id] ?? [];
            return (
              <button
                key={folder.id}
                className={`room-display folder-card${isAllTestFolder(rooms) ? " folder-card--test" : ""}`}
                onClick={() => setOpenFolderId(folder.id)}
              >
                <div className="room-display-header">
                  <span className="folder-card-name">
                    {folder.name}
                    {isAllTestFolder(rooms) && <TestFolderMarker />}
                  </span>
                  <span className="room-created-at">{rooms.length} room{rooms.length === 1 ? "" : "s"}</span>
                </div>
                {folder.description?.trim() && (
                  <p className="folder-card-description">{folder.description}</p>
                )}
                <span className="room-created-at">{formatDate(folder.createdAt)}</span>
              </button>
            );
          })}
        </div>
      )}

      <h3 className="rooms-section-title folder-section-heading">
        {folders.length > 0 ? "Unfiled rooms" : "Rooms"}
      </h3>
      {renderRooms(unfiledRooms, "No unfiled completed rooms.")}
      {modals}
    </div>
  );
}

export default CompletedRooms;
