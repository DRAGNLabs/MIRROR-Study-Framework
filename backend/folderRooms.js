import db from "./db.js";

// room_folders.rooms is a list of the roomCodes in each folder (oldest first).
// It duplicates rooms."folderId" (which is the source of truth) so the list
// is easy to see when looking at the table directly.
//
// It is NOT updated automatically — any route that changes which folder a
// room is in (creating a room with a folderId, moving a room, deleting a
// room, creating a folder with rooms) must call this afterwards with every
// folder that gained or lost a room.
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
