import test from "node:test";
import assert from "node:assert/strict";
import { buildPreviewExport, DuplicateParticipantNameError } from "./pseudonymize.js";

function lilyRoom() {
  return {
    roomCode: 100,
    fish_amount: { "1": 100 },
    llmResponse: { "1": "Lily receives 10 tons. Dale gets none." },
    llmInstructions: { "1": "Welcome lily" },
    userMessages: { "1": [[7, "I am lily and I need fish"]] },
    resourceAllocations: {
      "1": {
        allocationByUserName: {
          lily: { fish: 10, round: 1, totalFishSoFar: 10 },
        },
        assistantMessage: "Lily receives 10 tons.",
      },
    },
  };
}

test("rewrites lily everywhere and leaves fish counts and other names", () => {
  const room = lilyRoom();
  const users = [{ userId: 7, userName: "lily", roomCode: 100, role: 3 }];
  const surveys = [{
    roomCode: 100,
    userId: 7,
    data: {
      answers: { note: "lily felt heard" },
      conversationMarks: [{ note: "see lily" }],
    },
  }];
  const snapshot = structuredClone({ room, users, surveys });

  const exported = buildPreviewExport({ room, users, surveys });

  assert.deepEqual({ room, users, surveys }, snapshot);
  assert.equal(exported.preview, true);
  assert.match(exported.notice, /not deidentified/);
  assert.equal(exported.users[0].userName, "participant 7 (lily)");
  assert.equal(exported.users[0].userId, 7);
  assert.equal(exported.room.fish_amount["1"], 100);
  assert.equal(
    exported.room.llmResponse["1"],
    "participant 7 (lily) receives 10 tons. Dale gets none."
  );
  assert.equal(exported.room.llmInstructions["1"], "Welcome participant 7 (lily)");
  assert.deepEqual(exported.room.userMessages["1"], [[7, "I am participant 7 (lily) and I need fish"]]);
  assert.deepEqual(
    exported.room.resourceAllocations["1"].allocationByUserName["participant 7 (lily)"],
    { fish: 10, round: 1, totalFishSoFar: 10 }
  );
  assert.equal(
    exported.room.resourceAllocations["1"].assistantMessage,
    "participant 7 (lily) receives 10 tons."
  );
  assert.equal(exported.surveys[0].data.answers.note, "participant 7 (lily) felt heard");
  assert.equal(exported.surveys[0].data.conversationMarks[0].note, "see participant 7 (lily)");
  assert.equal(exported.surveys[0].userId, 7);
});

test("longer name wins when one name contains another", () => {
  const exported = buildPreviewExport({
    room: { llmResponse: { "1": "Anna and Ann asked for fish" } },
    users: [
      { userId: 1, userName: "Ann", roomCode: 1, role: 0 },
      { userId: 2, userName: "Anna", roomCode: 1, role: 0 },
    ],
    surveys: [],
  });

  assert.equal(
    exported.room.llmResponse["1"],
    "participant 2 (Anna) and participant 1 (Ann) asked for fish"
  );
});

test("possessive ending stays after the label", () => {
  const exported = buildPreviewExport({
    room: { llmResponse: { "1": "Lily's boat is ready" } },
    users: [{ userId: 7, userName: "lily", roomCode: 1, role: 0 }],
    surveys: [],
  });

  assert.equal(exported.room.llmResponse["1"], "participant 7 (lily)'s boat is ready");
});

test("does not rewrite the name inside the inserted label", () => {
  const exported = buildPreviewExport({
    room: { llmResponse: { "1": "Hello lily" } },
    users: [{ userId: 7, userName: "lily", roomCode: 1, role: 0 }],
    surveys: [],
  });

  assert.equal(exported.room.llmResponse["1"], "Hello participant 7 (lily)");
  assert.equal(
    exported.room.llmResponse["1"].split("participant 7 (lily)").length,
    2
  );
});

test("shared names in one room are rejected", () => {
  assert.throws(
    () => buildPreviewExport({
      room: {},
      users: [
        { userId: 1, userName: "Lily", roomCode: 1, role: 0 },
        { userId: 2, userName: "lily", roomCode: 1, role: 0 },
      ],
      surveys: [],
    }),
    DuplicateParticipantNameError
  );
});
