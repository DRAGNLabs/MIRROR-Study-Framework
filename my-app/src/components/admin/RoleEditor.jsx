/** Admin page for reading and editing a game's roles (games/*.json "roles" + "role_prompt").
 *  Two views:
 *   - One role: a single role's backstory, first message and every stage's text
 *   - Compare stages: one stage at a time with the roles side by side, to check they're balanced
 *  Edits are kept in the page until Save, which writes the game file (only when MODE=local). */

import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import games from "../../gameLoader";
import { getGameRoles, saveGameRoles } from "../../services/gamesService";
import "./admin.css";

// Status stages in the order the game files use them
const NEGATIVE_STAGES = ["-1", "-2", "-3", "-4", "-5", "-6", "-7", "-8"];
const POSITIVE_STAGES = ["1", "2", "3", "4", "5", "6", "7", "8"];
const START = "start"; // pseudo-stage for the backstory and the bot's first message

// Each stage has an "enter" set (status moved further from 0, into this stage) and an
// "exit" set (status moved back toward 0, out of this stage). See gameHandler.js.
const AUDIENCES = [
  { id: "player", label: "Player sees", enter: "enter", exit: "exit",
    hint: "Status update shown to the participant" },
  { id: "llm", label: "Lake Manager told", enter: "llm_enter", exit: "llm_exit",
    hint: "Added to the Lake Manager's prompt" },
  { id: "bot", label: "Bot request", enter: "enter_request", exit: "exit_request",
    hint: "Message the bot sends in automated tests" },
];
const STAGE_FIELDS = AUDIENCES.flatMap((a) => [
  { key: a.enter, audience: a.id, label: `${a.label}: entering` },
  { key: a.exit, audience: a.id, label: `${a.label}: leaving` },
]);
const START_FIELDS = [
  { key: "backstory", label: "Backstory (shown to the player)" },
  { key: "initial_request", label: "Bot's first message (initial_request)" },
];

function stageLabel(stage) {
  if (stage === START) return "Start";
  return Number(stage) > 0 ? `+${stage}` : `−${Math.abs(Number(stage))}`;
}

function wordCount(text) {
  const trimmed = (text ?? "").trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function rowsFor(text) {
  return Math.max(2, Math.min(14, Math.ceil((text ?? "").length / 55) + 1));
}

const clone = (value) => JSON.parse(JSON.stringify(value));

export default function RoleEditor() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const editableGames = useMemo(() => games.filter((g) => g.role_prompt), []);

  const gameId = params.get("game") ?? String(editableGames[0]?.id ?? "");
  const view = params.get("view") === "stage" ? "stage" : "role";
  const stage = params.get("stage") ?? "-1";

  const [loaded, setLoaded] = useState(null); // response from the server, as saved on disk
  const [draft, setDraft] = useState(null); // { roles, role_prompt } with unsaved edits
  const [status, setStatus] = useState({ kind: "", text: "" });
  const [saving, setSaving] = useState(false);
  const [hiddenRoles, setHiddenRoles] = useState([]); // role ids left out of the compare view
  const [hiddenFields, setHiddenFields] = useState([]); // field keys left out of the compare view

  const roleIds = useMemo(
    () => Object.keys(draft?.role_prompt ?? {}).sort((a, b) => Number(a) - Number(b)),
    [draft]
  );
  const roleId = roleIds.includes(params.get("role")) ? params.get("role") : roleIds[0];
  const dirty = Boolean(loaded && draft) &&
    JSON.stringify({ roles: loaded.roles, role_prompt: loaded.role_prompt }) !== JSON.stringify(draft);

  function setParam(changes) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v == null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  }

  async function load(id) {
    if (!id) return;
    setStatus({ kind: "", text: "" });
    try {
      const data = await getGameRoles(id);
      setLoaded(data);
      setDraft(clone({ roles: data.roles, role_prompt: data.role_prompt }));
    } catch (err) {
      setStatus({ kind: "error", text: err.message });
    }
  }

  useEffect(() => {
    load(gameId);
  }, [gameId]);

  // warn before closing the tab with unsaved edits
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function confirmDiscard() {
    return !dirty || window.confirm("You have unsaved changes. Discard them?");
  }

  // --- reading / writing one field of the draft ---
  function getValue(id, field) {
    if (field === "backstory") {
      return draft.roles.find((r) => String(r.id) === String(id))?.backstory ?? "";
    }
    if (field === "name" || field === "initial_request") return draft.role_prompt[id]?.[field] ?? "";
    return draft.role_prompt[id]?.[field.stage]?.[field.key] ?? "";
  }

  function hasValue(id, field) {
    if (typeof field === "string") return true;
    return draft.role_prompt[id]?.[field.stage]?.[field.key] !== undefined;
  }

  function setValue(id, field, value) {
    setDraft((prev) => {
      const next = clone(prev);
      if (field === "backstory" || field === "name") {
        // the role's name lives in both roles[] ("role") and role_prompt ("name")
        const role = next.roles.find((r) => String(r.id) === String(id));
        if (role) role[field === "name" ? "role" : "backstory"] = value;
        if (field === "name") next.role_prompt[id].name = value;
      } else if (field === "initial_request") {
        next.role_prompt[id].initial_request = value;
      } else {
        const stageSet = next.role_prompt[id][field.stage] ?? (next.role_prompt[id][field.stage] = {});
        const existedOnDisk = loaded.role_prompt[id]?.[field.stage]?.[field.key] !== undefined;
        // clearing a field that wasn't in the file leaves it out again instead of saving ""
        if (value === "" && !existedOnDisk) delete stageSet[field.key];
        else stageSet[field.key] = value;
      }
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setStatus({ kind: "", text: "" });
    try {
      const result = await saveGameRoles(gameId, { ...draft, hash: loaded.hash });
      setLoaded({ ...loaded, ...clone(draft), hash: result.hash });
      setStatus({
        kind: "ok",
        text: `Saved to games/${result.file}. Restart the backend so new rooms use the updated text.`,
      });
    } catch (err) {
      setStatus({ kind: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    if (!confirmDiscard()) return;
    setDraft(clone({ roles: loaded.roles, role_prompt: loaded.role_prompt }));
    setStatus({ kind: "", text: "" });
  }

  function toggle(list, setList, value) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  // --- rendering helpers (plain functions, not components, so textareas keep focus while typing) ---
  function renderTextCell(id, field, placeholder) {
    const value = getValue(id, field);
    const missing = !hasValue(id, field);
    return (
      <textarea
        className={`role-editor-textarea ${missing ? "role-editor-textarea--missing" : ""}`}
        value={value}
        rows={rowsFor(value)}
        placeholder={missing ? "(not in the file)" : placeholder}
        readOnly={!loaded.canSave}
        onChange={(e) => setValue(id, field, e.target.value)}
      />
    );
  }

  function renderOneRole() {
    const name = getValue(roleId, "name");
    return (
      <>
        <div className="role-editor-chips">
          {roleIds.map((id) => (
            <button
              key={id}
              type="button"
              className={`role-editor-chip ${id === roleId ? "role-editor-chip--active" : ""}`}
              onClick={() => setParam({ role: id })}
            >
              {draft.role_prompt[id]?.name || `Role ${id}`}
            </button>
          ))}
        </div>

        <div className="room-display role-editor-card">
          <label className="role-editor-label">
            Name
            <input
              className="role-editor-input"
              value={name}
              readOnly={!loaded.canSave}
              onChange={(e) => setValue(roleId, "name", e.target.value)}
            />
          </label>
          {START_FIELDS.map((f) => (
            <label key={f.key} className="role-editor-label">
              {f.label} <span className="role-editor-count">{wordCount(getValue(roleId, f.key))} words</span>
              {renderTextCell(roleId, f.key)}
            </label>
          ))}
        </div>

        {[["Getting worse (−1 to −8)", NEGATIVE_STAGES], ["Getting better (+1 to +8)", POSITIVE_STAGES]].map(
          ([title, stages]) => (
            <div key={title}>
              <h3 className="role-editor-section-title">{title}</h3>
              {stages.map((s) => (
                <div key={s} className="room-display role-editor-card">
                  <div className="role-editor-stage-header">
                    <span className={`role-editor-stage-badge ${Number(s) < 0 ? "is-negative" : "is-positive"}`}>
                      {stageLabel(s)}
                    </span>
                    <button
                      type="button"
                      className="btn-secondary-admin role-editor-small-btn"
                      onClick={() => setParam({ view: "stage", stage: s })}
                    >
                      Compare this stage across roles
                    </button>
                  </div>
                  <div className="role-editor-stage-grid">
                    <div />
                    <div className="role-editor-col-head">Entering (status moved to {stageLabel(s)})</div>
                    <div className="role-editor-col-head">Leaving (status moved back from {stageLabel(s)})</div>
                    {AUDIENCES.map((a) => renderAudienceRow(a, roleId, s))}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </>
    );
  }

  function renderAudienceRow(audience, id, s) {
    return (
      <Fragment key={audience.id}>
        <div className="role-editor-row-head" title={audience.hint}>
          {audience.label}
          <span className="role-editor-row-hint">{audience.hint}</span>
        </div>
        {renderTextCell(id, { stage: s, key: audience.enter })}
        {renderTextCell(id, { stage: s, key: audience.exit })}
      </Fragment>
    );
  }

  function renderCompare() {
    const shownRoles = roleIds.filter((id) => !hiddenRoles.includes(id));
    const fields = stage === START
      ? START_FIELDS.map((f) => ({ ...f, field: f.key }))
      : STAGE_FIELDS.filter((f) => !hiddenFields.includes(f.key)).map((f) => ({ ...f, field: { stage, key: f.key } }));
    const stageIndex = [...NEGATIVE_STAGES].reverse().concat([START], POSITIVE_STAGES);

    return (
      <>
        <div className="role-editor-stage-picker">
          {stageIndex.map((s) => (
            <button
              key={s}
              type="button"
              className={`role-editor-stage-btn ${s === stage ? "role-editor-stage-btn--active" : ""} ${
                s === START ? "" : Number(s) < 0 ? "is-negative" : "is-positive"
              }`}
              onClick={() => setParam({ stage: s })}
            >
              {stageLabel(s)}
            </button>
          ))}
        </div>

        <div className="role-editor-filters">
          <span className="role-editor-filter-label">Roles:</span>
          {roleIds.map((id) => (
            <label key={id} className="role-editor-filter">
              <input type="checkbox" checked={!hiddenRoles.includes(id)}
                onChange={() => toggle(hiddenRoles, setHiddenRoles, id)} />
              {draft.role_prompt[id]?.name || `Role ${id}`}
            </label>
          ))}
        </div>
        {stage !== START && (
          <div className="role-editor-filters">
            <span className="role-editor-filter-label">Fields:</span>
            {STAGE_FIELDS.map((f) => (
              <label key={f.key} className="role-editor-filter">
                <input type="checkbox" checked={!hiddenFields.includes(f.key)}
                  onChange={() => toggle(hiddenFields, setHiddenFields, f.key)} />
                {f.label}
              </label>
            ))}
          </div>
        )}

        <div className="role-editor-compare-wrap">
          <table className="role-editor-compare">
            <thead>
              <tr>
                <th className="role-editor-compare-corner">{stageLabel(stage)}</th>
                {shownRoles.map((id) => (
                  <th key={id}>
                    <button type="button" className="role-editor-link"
                      onClick={() => setParam({ view: "role", role: id })}
                      title="Open this role on its own">
                      {draft.role_prompt[id]?.name || `Role ${id}`}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => {
                const counts = shownRoles.map((id) => wordCount(getValue(id, f.field)));
                const max = Math.max(1, ...counts);
                return (
                  <tr key={f.key}>
                    <th className="role-editor-compare-rowhead">{f.label}</th>
                    {shownRoles.map((id, i) => (
                      <td key={id}>
                        {renderTextCell(id, f.field)}
                        {/* bar = this text's length relative to the longest in the row */}
                        <div className="role-editor-length">
                          <div className="role-editor-length-bar" style={{ width: `${(counts[i] / max) * 100}%` }} />
                          <span className="role-editor-count">{counts[i]} words</span>
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <div className="admin-container admin-dashboard role-editor-page">
      <div className="role-editor">
        <div className="role-editor-top">
          <button className="btn-secondary-admin" onClick={() => confirmDiscard() && navigate("/admin")}>
            Back
          </button>
          <div className="role-editor-title">
            <h2 className="rooms-section-title">Role Editor</h2>
            {loaded && <p className="rooms-section-subtitle">games/{loaded.file}</p>}
          </div>
          {editableGames.length > 1 && (
            <select
              className="role-editor-select"
              value={gameId}
              onChange={(e) => confirmDiscard() && setParam({ game: e.target.value, role: null })}
            >
              {editableGames.map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
          )}
          {loaded?.canSave && (
            <div className="role-editor-actions">
              <button className="btn-secondary-admin" onClick={discard} disabled={!dirty || saving}>
                Discard changes
              </button>
              <button className="btn-primary-admin" onClick={save} disabled={!dirty || saving}>
                {saving ? "Saving..." : dirty ? "Save to file" : "Saved"}
              </button>
            </div>
          )}
        </div>

        {loaded && !loaded.canSave && (
          <p className="role-editor-banner">
            Read-only here. Editing and saving only work on your local site (MODE=local), since saving
            writes the game file in the repo.
          </p>
        )}
        {status.text && (
          <p className={`role-editor-banner ${status.kind === "error" ? "is-error" : "is-ok"}`}>{status.text}</p>
        )}

        {draft && roleId && (
          <>
            <div className="role-editor-tabs">
              <button type="button"
                className={`role-editor-tab ${view === "role" ? "role-editor-tab--active" : ""}`}
                onClick={() => setParam({ view: "role" })}>
                One role
              </button>
              <button type="button"
                className={`role-editor-tab ${view === "stage" ? "role-editor-tab--active" : ""}`}
                onClick={() => setParam({ view: "stage" })}>
                Compare stages
              </button>
            </div>
            {view === "role" ? renderOneRole() : renderCompare()}
          </>
        )}
      </div>
    </div>
  );
}
