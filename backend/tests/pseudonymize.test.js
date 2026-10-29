import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDeidentificationData,
  buildPreviewExport,
  DuplicateParticipantNameError,
  RedactionCollisionError,
} from "../deidentify/pseudonymize.js";

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
  assert.match(exported.notice, /not guaranteed to be deidentified/);
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

test("deidentification preview redacts selected PII classes without mutating source data", () => {
  const room = {
    roomCode: 100,
    fish_amount: { "1": 100 },
    llmResponse: {
      "1": "Lily wrote lily@example.org and called +1 (415) 555-2671.",
    },
    llmInstructions: {},
    userMessages: {},
    resourceAllocations: {
      "1": {
        allocationByUserName: {
          Lily: { fish: 10 },
        },
      },
    },
  };
  const users = [{ userId: 7, userName: "Lily", roomCode: 100, role: 0 }];
  const surveys = [{
    roomCode: 100,
    userId: 7,
    data: {
      address: "Home address: 44 Pine Street, Seattle WA",
      note: "Keep this answer and its number 12.",
    },
  }];
  const sourceSnapshot = structuredClone({ room, users, surveys });

  const result = buildDeidentificationData({ room, users, surveys });

  assert.deepEqual({ room, users, surveys }, sourceSnapshot);
  assert.equal(result.users[0].userName, "Participant 7");
  assert.equal(
    result.room.llmResponse["1"],
    "Participant 7 wrote [REDACTED EMAIL] and called [REDACTED PHONE]."
  );
  assert.deepEqual(
    result.room.resourceAllocations["1"].allocationByUserName,
    { "Participant 7": { fish: 10 } }
  );
  assert.equal(result.surveys[0].data.address, "[REDACTED LOCATION]");
  assert.equal(result.surveys[0].data.note, "Keep this answer and its number 12.");
  assert.equal(result.room.fish_amount["1"], 100);
  assert.deepEqual(result.summary, {
    participants: 1,
    participantNames: 3,
    emails: 1,
    phoneNumbers: 1,
    locations: 1,
  });
});

test("deidentification redacts sensitive-looking object keys", () => {
  const result = buildDeidentificationData({
    room: {},
    users: [{ userId: 4, userName: "Ari", roomCode: 2, role: 0 }],
    surveys: [{
      roomCode: 2,
      userId: 4,
      data: { "ari@example.com": "555-123-9876" },
    }],
  });

  assert.deepEqual(result.surveys[0].data, {
    "[REDACTED EMAIL]": "[REDACTED PHONE]",
  });
});

test("deidentification fails rather than overwriting keys that redact identically", () => {
  assert.throws(
    () => buildDeidentificationData({
      room: {},
      users: [],
      surveys: [{
        roomCode: 2,
        userId: 4,
        data: {
          "first@example.com": "one",
          "second@example.com": "two",
        },
      }],
    }),
    RedactionCollisionError
  );
});

test("preserves JSON keys that have special JavaScript object behavior", () => {
  const data = JSON.parse('{"__proto__":"Lily"}');
  const result = buildDeidentificationData({
    room: {},
    users: [{ userId: 3, userName: "Lily", roomCode: 1, role: 0 }],
    surveys: [{ roomCode: 1, userId: 3, data }],
  });

  assert.equal(Object.hasOwn(result.surveys[0].data, "__proto__"), true);
  assert.equal(result.surveys[0].data.__proto__, "Participant 3");
  assert.equal(Object.getPrototypeOf(result.surveys[0].data), Object.prototype);
});

test("export does not put an already-pseudonymized name back in parentheses", () => {
  const exported = buildPreviewExport({
    room: { llmResponse: { "1": "Participant 7 gave an answer" } },
    users: [{ userId: 7, userName: "Participant 7", roomCode: 1, role: 0 }],
    surveys: [],
  });

  assert.equal(exported.users[0].userName, "participant 7");
  assert.equal(exported.room.llmResponse["1"], "participant 7 gave an answer");
});
