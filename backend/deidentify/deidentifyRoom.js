import { createHash } from "node:crypto";
import { buildDeidentificationData } from "./pseudonymize.js";

export class CompletedRoomNotFoundError extends Error {
  constructor() {
    super("Completed room not found");
    this.name = "CompletedRoomNotFoundError";
  }
}

export class DeidentificationPreviewChangedError extends Error {
  constructor() {
    super("Room data changed after preview; refresh and review the preview again.");
    this.name = "DeidentificationPreviewChangedError";
  }
}

export function deidentificationPreviewToken(redacted) {
  const data = JSON.stringify({
    room: redacted.room,
    users: redacted.users,
    surveys: redacted.surveys,
  });
  return createHash("sha256").update(data).digest("hex");
}

export async function persistRoomDeidentification(
  client,
  roomCode,
  loadRoomData,
  expectedPreviewToken
) {
  let transactionStarted = false;
  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const data = await loadRoomData(client, roomCode, true);
    if (!data) throw new CompletedRoomNotFoundError();

    const redacted = buildDeidentificationData(data);
    if (deidentificationPreviewToken(redacted) !== expectedPreviewToken) {
      throw new DeidentificationPreviewChangedError();
    }

    const roomUpdate = await client.query(
      `UPDATE rooms
       SET "llmResponse" = $1::jsonb,
           "llmInstructions" = $2::jsonb,
           "userMessages" = $3::jsonb,
           "resourceAllocations" = $4::jsonb
       WHERE "roomCode" = $5 AND completed = TRUE`,
      [
        JSON.stringify(redacted.room.llmResponse ?? {}),
        JSON.stringify(redacted.room.llmInstructions ?? {}),
        JSON.stringify(redacted.room.userMessages ?? {}),
        JSON.stringify(redacted.room.resourceAllocations ?? {}),
        roomCode,
      ]
    );
    if (roomUpdate.rowCount !== 1) {
      throw new Error(`Expected to update one completed room, updated ${roomUpdate.rowCount}`);
    }

    for (const user of redacted.users) {
      const result = await client.query(
        'UPDATE users SET "userName" = $1 WHERE "userId" = $2 AND "roomCode" = $3',
        [user.userName, user.userId, roomCode]
      );
      if (result.rowCount !== 1) {
        throw new Error(`Expected to update user ${user.userId}, updated ${result.rowCount}`);
      }
    }

    for (const survey of redacted.surveys) {
      const result = await client.query(
        'UPDATE survey SET data = $1::jsonb WHERE "roomCode" = $2 AND "userId" = $3',
        [JSON.stringify(survey.data ?? {}), roomCode, survey.userId]
      );
      if (result.rowCount !== 1) {
        throw new Error(`Expected to update survey for user ${survey.userId}, updated ${result.rowCount}`);
      }
    }

    await client.query("COMMIT");
    transactionStarted = false;
    return redacted.summary;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Failed to roll back deidentification transaction:", rollbackError);
      }
    }
    throw error;
  }
}
