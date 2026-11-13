import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const _dirname = path.dirname(fileURLToPath(import.meta.url));
const testScriptsDir = path.resolve(_dirname, "../../games/test_scripts");

// Test scripts are fixed bot messages for automated tests (e.g. real messages from a
// pilot study), used instead of each role's initial/enter/exit_request text.
// Format: { id, title, gameId, users: [{ id, name, role }], rounds: { "1": [[userId, message], ...], ... } }
export function loadTestScripts() {
  if (!fs.existsSync(testScriptsDir)) return [];
  return fs.readdirSync(testScriptsDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(fs.readFileSync(path.join(testScriptsDir, file), "utf-8")));
}
