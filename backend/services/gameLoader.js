import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);
const gamesDir = path.resolve(_dirname, "../../games");
// const gamesDir = path.resolve(process.cwd(), "games");

export function loadGames() {
  return fs.readdirSync(gamesDir)
    .filter(file => file.endsWith(".json"))
    .map(file => {
      const filePath = path.join(gamesDir, file);
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    });
}
