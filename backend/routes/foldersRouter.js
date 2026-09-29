import express from "express";
const router = express.Router();
import db from "../db.js";

// Folders group completed rooms (mostly automated test batches) so results
// from different versions of the code/prompts can be kept apart. The
// description is free text written by the researcher about what changed.

// room_folders.rooms is a list of the roomCodes in each folder (oldest first).
// It duplicates rooms."folderId" (which is the source of truth) so the list
// is easy to see when looking at the table directly.
//
// It is NOT updated automatically — any route that changes which folder a
// room is in (creating a room with a folderId, moving a room, deleting a
// room, creating a folder with rooms) must call this afterwards with every
// folder that gained or lost a room. roomsRouter.js imports it from here.
export async function syncFolderRooms(folderIds) {
  const ids = [...new Set(folderIds)].filter((id) => id != null);
  if (ids.length === 0) return;

  await db.query(
    `UPDATE room_folders f
     SET rooms = COALESCE(
       (SELECT jsonb_agg(r."roomCode" ORDER BY r."createdAt")
        FROM rooms r WHERE r."folderId" = f.id),
       '[]'::jsonb
     )
     WHERE f.id = ANY($1::int[]);`,
    [ids]
  );
}

// gets all folders
router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM room_folders ORDER BY "createdAt" DESC;'
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// creates a folder, optionally moving existing rooms into it
router.post("/", async (req, res) => {
  try {
    const { name, description, roomCodes } = req.body;
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }

    const result = await db.query(
      'INSERT INTO room_folders (name, description) VALUES ($1, $2) RETURNING *;',
      [name.trim(), typeof description === "string" ? description : ""]
    );
    let folder = result.rows[0];

    if (Array.isArray(roomCodes) && roomCodes.length > 0) {
      const codes = roomCodes.map(Number);
      // any folders these rooms are leaving also need their rooms list updated
      const before = await db.query(
        'SELECT DISTINCT "folderId" FROM rooms WHERE "roomCode" = ANY($1::int[]);',
        [codes]
      );
      await db.query(
        'UPDATE rooms SET "folderId" = $1 WHERE "roomCode" = ANY($2::int[]);',
        [folder.id, codes]
      );
      await syncFolderRooms([folder.id, ...before.rows.map((r) => r.folderId)]);
      const refreshed = await db.query('SELECT * FROM room_folders WHERE id = $1;', [folder.id]);
      folder = refreshed.rows[0];
    }

    return res.status(201).json(folder);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// updates a folder's name and/or description
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return res.status(400).json({ error: "name cannot be empty" });
    }

    const result = await db.query(
      `UPDATE room_folders
       SET name = COALESCE($1, name), description = COALESCE($2, description)
       WHERE id = $3
       RETURNING *;`,
      [name?.trim() ?? null, description ?? null, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Folder not found" });
    }

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// deletes a folder; its rooms are kept and become unfiled (ON DELETE SET NULL)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM room_folders WHERE id = $1;', [id]);
    return res.status(200).json({ success: true, deleted: result.rowCount });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
