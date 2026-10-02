export class DuplicateParticipantNameError extends Error {
  constructor(name) {
    super(`Two participants in this room share the name "${name}"`);
    this.name = "DuplicateParticipantNameError";
  }
}

const PREVIEW_NOTICE =
  "Original names are still included in parentheses. This file is not deidentified.";

function foldedName(userName) {
  return String(userName ?? "").trim().toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function participantLabel(user) {
  return `participant ${user.userId} (${user.userName})`;
}

function buildMatchers(users) {
  const labelByFoldedName = new Map();

  for (const user of users) {
    const folded = foldedName(user.userName);
    if (!folded) continue;
    if (labelByFoldedName.has(folded)) {
      throw new DuplicateParticipantNameError(String(user.userName).trim());
    }
    labelByFoldedName.set(folded, participantLabel(user));
  }

  const names = [...labelByFoldedName.keys()].sort((a, b) => b.length - a.length);
  const pattern = names.length
    ? new RegExp(
        `(?<![\\p{L}\\p{N}])(?:${names.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}])`,
        "giu"
      )
    : null;

  function replaceNames(text) {
    if (!pattern || typeof text !== "string") return text;
    pattern.lastIndex = 0;
    return text.replace(pattern, (matched) => {
      return labelByFoldedName.get(matched.toLowerCase()) ?? matched;
    });
  }

  return { labelByFoldedName, replaceNames };
}

function mapStrings(value, replaceNames) {
  if (typeof value === "string") return replaceNames(value);
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, replaceNames));
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = mapStrings(nested, replaceNames);
    }
    return out;
  }
  return value;
}

function rewriteAllocations(allocations, replaceNames, labelByFoldedName) {
  if (!allocations || typeof allocations !== "object" || Array.isArray(allocations)) {
    return mapStrings(allocations, replaceNames);
  }

  const out = {};
  for (const [round, entry] of Object.entries(allocations)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      out[round] = mapStrings(entry, replaceNames);
      continue;
    }

    const nextEntry = {};
    for (const [key, value] of Object.entries(entry)) {
      if (key === "allocationByUserName" && value && typeof value === "object" && !Array.isArray(value)) {
        const renamed = {};
        for (const [name, allocation] of Object.entries(value)) {
          const label = labelByFoldedName.get(foldedName(name));
          renamed[label ?? name] = mapStrings(allocation, replaceNames);
        }
        nextEntry[key] = renamed;
        continue;
      }
      nextEntry[key] = mapStrings(value, replaceNames);
    }
    out[round] = nextEntry;
  }
  return out;
}

export function buildPreviewExport({ room, users, surveys }) {
  const sourceRoom = room ?? {};
  const sourceUsers = users ?? [];
  const sourceSurveys = surveys ?? [];
  const { labelByFoldedName, replaceNames } = buildMatchers(sourceUsers);

  const exportedRoom = structuredClone(sourceRoom);
  exportedRoom.llmResponse = mapStrings(exportedRoom.llmResponse, replaceNames);
  exportedRoom.llmInstructions = mapStrings(exportedRoom.llmInstructions, replaceNames);
  exportedRoom.userMessages = mapStrings(exportedRoom.userMessages, replaceNames);
  exportedRoom.resourceAllocations = rewriteAllocations(
    exportedRoom.resourceAllocations,
    replaceNames,
    labelByFoldedName
  );

  return {
    preview: true,
    notice: PREVIEW_NOTICE,
    room: exportedRoom,
    users: sourceUsers.map((user) => ({
      ...structuredClone(user),
      userName: participantLabel(user),
    })),
    surveys: sourceSurveys.map((survey) => {
      const copy = structuredClone(survey);
      copy.data = mapStrings(copy.data, replaceNames);
      return copy;
    }),
  };
}
