import express from "express";
import crypto from "crypto";
import dotenv from "dotenv";
import { findGameFile, writeGameFile } from "../services/gameFileWriter.js";
dotenv.config();

const router = express.Router();

// Role editor (admin "Roles" page): reads and saves a game file's "roles" and
// "role_prompt" sections. Saving writes games/*.json directly, so it's only allowed
// when MODE=local. On a deployed site the file would be overwritten by the next
// deploy, and edits belong in git anyway.
function canSave() {
  return (process.env.MODE || "").trim().toLowerCase() === "local";
}

// Fingerprint of the role sections, so a save is refused if the file was edited
// by hand (or in another tab) after the editor loaded it
function roleHash(game) {
  return crypto
    .createHash("sha1")
    .update(JSON.stringify({ roles: game.roles ?? null, role_prompt: game.role_prompt ?? null }))
    .digest("hex");
}

router.get("/:gameId/roles", (req, res) => {
  try {
    const found = findGameFile(req.params.gameId);
    if (!found) return res.status(404).json({ error: "Game not found" });
    const { file, game } = found;
    res.json({
      file,
      title: game.title,
      roles: game.roles ?? [],
      role_prompt: game.role_prompt ?? {},
      hash: roleHash(game),
      canSave: canSave(),
    });
  } catch (err) {
    res.status(500).json({ error: "Could not read game file", details: err.message });
  }
});

router.put("/:gameId/roles", (req, res) => {
  if (!canSave()) {
    return res.status(403).json({ error: "Saving game files is only allowed when MODE=local" });
  }
  const { roles, role_prompt, hash } = req.body ?? {};
  if (!Array.isArray(roles) || !role_prompt || typeof role_prompt !== "object" || Array.isArray(role_prompt)) {
    return res.status(400).json({ error: "Expected { roles: [...], role_prompt: {...} }" });
  }
  try {
    const found = findGameFile(req.params.gameId);
    if (!found) return res.status(404).json({ error: "Game not found" });
    const { file, filePath, game } = found;
    if (hash && hash !== roleHash(game)) {
      return res.status(409).json({
        error: `${file} was changed on disk after you opened the editor. Reload to get the latest version (your unsaved edits will be lost), or copy them somewhere first.`,
      });
    }
    // Only the two role sections are replaced; everything else in the file stays as it is
    game.roles = roles;
    game.role_prompt = role_prompt;
    writeGameFile(filePath, game);
    res.json({ ok: true, file, hash: roleHash(game) });
  } catch (err) {
    res.status(500).json({ error: "Could not save game file", details: err.message });
  }
});

export default router;
