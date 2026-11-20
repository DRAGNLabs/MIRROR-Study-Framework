import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);
const gamesDir = path.resolve(_dirname, "../../games");

// Finds the games/*.json file whose "id" matches, read fresh from disk
export function findGameFile(gameId) {
  for (const file of fs.readdirSync(gamesDir).filter((f) => f.endsWith(".json"))) {
    const filePath = path.join(gamesDir, file);
    const game = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (String(game.id) === String(gameId)) return { file, filePath, game };
  }
  return null;
}

// Key order for writing: regular keys keep their order, then status stages -1, -2, ...,
// then 1, 2, ... (the order game4.json uses). JS objects always put integer keys like
// "1" first, so plain JSON.stringify would reorder every role's stages.
function orderedKeys(obj) {
  const keys = Object.keys(obj);
  const isStage = (k) => /^-?\d+$/.test(k);
  const negatives = keys.filter((k) => isStage(k) && Number(k) < 0).sort((a, b) => Number(b) - Number(a));
  const positives = keys.filter((k) => isStage(k) && Number(k) >= 0).sort((a, b) => Number(a) - Number(b));
  return [...keys.filter((k) => !isStage(k)), ...negatives, ...positives];
}

// Same output as JSON.stringify(value, null, 4) except for the stage order above
export function stringifyGame(value, depth = 0) {
  const pad = " ".repeat(4 * (depth + 1));
  const closePad = " ".repeat(4 * depth);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[\n${value.map((v) => pad + stringifyGame(v, depth + 1)).join(",\n")}\n${closePad}]`;
  }
  if (value && typeof value === "object") {
    const keys = orderedKeys(value).filter((k) => value[k] !== undefined);
    if (keys.length === 0) return "{}";
    return `{\n${keys
      .map((k) => `${pad}${JSON.stringify(k)}: ${stringifyGame(value[k], depth + 1)}`)
      .join(",\n")}\n${closePad}}`;
  }
  return JSON.stringify(value);
}

export function writeGameFile(filePath, game) {
  fs.writeFileSync(filePath, stringifyGame(game), "utf-8");
}
