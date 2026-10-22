export class DuplicateParticipantNameError extends Error {
  constructor(name) {
    super(`Two participants in this room share the name "${name}"`);
    this.name = "DuplicateParticipantNameError";
  }
}

export class RedactionCollisionError extends Error {
  constructor(key) {
    super(`Redacting object keys would overwrite the key "${key}"`);
    this.name = "RedactionCollisionError";
  }
}

const PREVIEW_NOTICE =
  "This file is not guaranteed to be deidentified. Original participant names appear in parentheses only when they are still present in the database.";

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const PHONE_PATTERN =
  /(?<!\d)(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]\d{3,4}[\s.-]\d{3,4}(?!\d)/g;
const LOCATION_PATTERNS = [
  /\b(?:street address|home address|address|location)\s*(?::|=|\bis\b)\s*[^;\n]+/giu,
  /(?<![\p{L}\p{N}])\d{1,6}\s+(?:[\p{L}\p{N}.'#-]+\s+){0,5}(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|place|pl|highway|hwy)\.?(?![\p{L}])/giu,
];

function foldedName(userName) {
  return String(userName ?? "").trim().toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function setOwn(target, key, value) {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function participantLabel(user) {
  const pseudonym = `participant ${user.userId}`;
  if (String(user.userName ?? "").trim().toLowerCase() === pseudonym) {
    return pseudonym;
  }
  return `${pseudonym} (${user.userName})`;
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
      setOwn(out, key, mapStrings(nested, replaceNames));
    }
    return out;
  }
  return value;
}

function mapRedactedStrings(value, redactText) {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map((item) => mapRedactedStrings(item, redactText));
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      const redactedKey = redactText(key);
      if (Object.hasOwn(out, redactedKey)) {
        throw new RedactionCollisionError(redactedKey);
      }
      setOwn(out, redactedKey, mapRedactedStrings(nested, redactText));
    }
    return out;
  }
  return value;
}

function replacePattern(text, pattern, replacement, categoryCounts, category) {
  pattern.lastIndex = 0;
  return text.replace(pattern, () => {
    categoryCounts[category] += 1;
    return replacement;
  });
}

function buildDeidentificationTransform(users, categoryCounts) {
  const participantLabelByFoldedName = new Map();

  for (const user of users) {
    const folded = foldedName(user.userName);
    if (!folded) continue;
    if (participantLabelByFoldedName.has(folded)) {
      throw new DuplicateParticipantNameError(String(user.userName).trim());
    }
    participantLabelByFoldedName.set(folded, `Participant ${user.userId}`);
  }

  const names = [...participantLabelByFoldedName.keys()].sort((a, b) => b.length - a.length);
  const participantPattern = names.length
    ? new RegExp(
        `(?<![\\p{L}\\p{N}])(?:${names.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}])`,
        "giu"
      )
    : null;

  function redactText(value) {
    let redacted = replacePattern(value, EMAIL_PATTERN, "[REDACTED EMAIL]", categoryCounts, "emails");
    redacted = replacePattern(redacted, PHONE_PATTERN, "[REDACTED PHONE]", categoryCounts, "phoneNumbers");
    for (const pattern of LOCATION_PATTERNS) {
      redacted = replacePattern(redacted, pattern, "[REDACTED LOCATION]", categoryCounts, "locations");
    }

    if (participantPattern) {
      participantPattern.lastIndex = 0;
      redacted = redacted.replace(participantPattern, (matched) => {
        categoryCounts.participantNames += 1;
        return participantLabelByFoldedName.get(matched.toLowerCase()) ?? matched;
      });
    }

    return redacted;
  }

  return { redactText };
}

function rewriteAllocations(allocations, replaceNames, labelByFoldedName) {
  if (!allocations || typeof allocations !== "object" || Array.isArray(allocations)) {
    return mapStrings(allocations, replaceNames);
  }

  const out = {};
  for (const [round, entry] of Object.entries(allocations)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      setOwn(out, round, mapStrings(entry, replaceNames));
      continue;
    }

    const nextEntry = {};
    for (const [key, value] of Object.entries(entry)) {
      if (key === "allocationByUserName" && value && typeof value === "object" && !Array.isArray(value)) {
        const renamed = {};
        for (const [name, allocation] of Object.entries(value)) {
          const label = labelByFoldedName.get(foldedName(name));
          setOwn(renamed, label ?? name, mapStrings(allocation, replaceNames));
        }
        setOwn(nextEntry, key, renamed);
        continue;
      }
      setOwn(nextEntry, key, mapStrings(value, replaceNames));
    }
    setOwn(out, round, nextEntry);
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

export function buildDeidentificationData({ room, users, surveys }) {
  const sourceRoom = room ?? {};
  const sourceUsers = users ?? [];
  const sourceSurveys = surveys ?? [];
  const categoryCounts = {
    participantNames: 0,
    emails: 0,
    phoneNumbers: 0,
    locations: 0,
  };
  const { redactText } = buildDeidentificationTransform(sourceUsers, categoryCounts);
  const redactedRoom = structuredClone(sourceRoom);

  for (const key of ["llmResponse", "llmInstructions", "userMessages", "resourceAllocations"]) {
    if (Object.hasOwn(redactedRoom, key)) {
      redactedRoom[key] = mapRedactedStrings(redactedRoom[key], redactText);
    }
  }

  const redactedUsers = sourceUsers.map((user) => {
    return {
      ...mapRedactedStrings(structuredClone(user), redactText),
      userName: `Participant ${user.userId}`,
    };
  });
  const redactedSurveys = sourceSurveys.map((survey) =>
    mapRedactedStrings(structuredClone(survey), redactText)
  );

  return {
    room: redactedRoom,
    users: redactedUsers,
    surveys: redactedSurveys,
    summary: {
      participants: redactedUsers.length,
      ...categoryCounts,
    },
  };
}
