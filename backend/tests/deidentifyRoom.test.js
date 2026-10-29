import test from "node:test";
import assert from "node:assert/strict";
import {
  CompletedRoomNotFoundError,
  DeidentificationPreviewChangedError,
  deidentificationPreviewToken,
  persistRoomDeidentification,
} from "../deidentify/deidentifyRoom.js";
import { buildDeidentificationData } from "../deidentify/pseudonymize.js";

function fakeClient({ missingUpdate } = {}) {
  const calls = [];
  const client = {
    calls,
    async query(sql, params = []) {
      calls.push({ sql: String(sql).trim(), params });
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rowCount: null };
      }
      if (String(sql).includes("UPDATE rooms")) {
        return { rowCount: 1 };
      }
      if (String(sql).includes("UPDATE users")) {
        return { rowCount: missingUpdate === "user" ? 0 : 1 };
      }
      if (String(sql).includes("UPDATE survey")) {
        return { rowCount: missingUpdate === "survey" ? 0 : 1 };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  return client;
}

function roomData() {
  return {
    room: {
      roomCode: 5,
      completed: true,
      llmResponse: { "1": "Lily emailed lily@example.org" },
      llmInstructions: {},
      userMessages: {},
      resourceAllocations: {},
    },
    users: [{ userId: 8, userName: "Lily", roomCode: 5, role: 0 }],
    surveys: [{
      roomCode: 5,
      userId: 8,
      data: { note: "Call 415-555-0199" },
    }],
  };
}

test("persists all redacted data in one transaction", async () => {
  const client = fakeClient();
  const data = roomData();
  const previewToken = deidentificationPreviewToken(
    buildDeidentificationData(data)
  );
  const summary = await persistRoomDeidentification(
    client,
    5,
    async (queryable, roomCode, lockRows) => {
      assert.equal(queryable, client);
      assert.equal(roomCode, 5);
      assert.equal(lockRows, true);
      return data;
    },
    previewToken
  );

  const queries = client.calls.map(({ sql }) => sql.replace(/\s+/g, " ").trim());
  assert.equal(queries[0], "BEGIN");
  assert.match(queries[1], /^UPDATE rooms SET/);
  assert.equal(
    queries[2],
    'UPDATE users SET "userName" = $1 WHERE "userId" = $2 AND "roomCode" = $3'
  );
  assert.equal(
    queries[3],
    'UPDATE survey SET data = $1::jsonb WHERE "roomCode" = $2 AND "userId" = $3'
  );
  assert.equal(queries[4], "COMMIT");
  assert.deepEqual(summary, {
    participants: 1,
    participantNames: 2,
    emails: 1,
    phoneNumbers: 1,
    locations: 0,
  });
  assert.equal(
    JSON.parse(client.calls[1].params[0])["1"],
    "Participant 8 emailed [REDACTED EMAIL]"
  );
  assert.equal(client.calls[2].params[0], "Participant 8");
  assert.equal(JSON.parse(client.calls[3].params[0]).note, "Call [REDACTED PHONE]");
});

test("rolls back when any related record cannot be updated", async () => {
  const client = fakeClient({ missingUpdate: "survey" });
  const data = roomData();
  const previewToken = deidentificationPreviewToken(
    buildDeidentificationData(data)
  );

  await assert.rejects(
    persistRoomDeidentification(client, 5, async () => data, previewToken),
    /Expected to update survey for user 8/
  );

  assert.equal(client.calls.at(-1).sql, "ROLLBACK");
  assert.equal(client.calls.some(({ sql }) => sql === "COMMIT"), false);
});

test("rolls back when the completed room no longer exists", async () => {
  const client = fakeClient();

  await assert.rejects(
    persistRoomDeidentification(client, 5, async () => null, "a".repeat(64)),
    CompletedRoomNotFoundError
  );

  assert.deepEqual(
    client.calls.map(({ sql }) => sql),
    ["BEGIN", "ROLLBACK"]
  );
});

test("rolls back without writes when room data differs from the reviewed preview", async () => {
  const client = fakeClient();

  await assert.rejects(
    persistRoomDeidentification(
      client,
      5,
      async () => roomData(),
      "a".repeat(64)
    ),
    DeidentificationPreviewChangedError
  );

  assert.deepEqual(
    client.calls.map(({ sql }) => sql),
    ["BEGIN", "ROLLBACK"]
  );
});
