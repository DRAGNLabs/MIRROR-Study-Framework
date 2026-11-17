import MessageMarkdown from "../interaction/MessageMarkdown.jsx";
import { PROMPT_FIELDS } from "./completedRoomUtils";

// Collapsible view of the prompt templates saved on an automated test room.
export function PromptSnapshot({ snapshot }) {
  if (!snapshot) return null;
  return (
    <div className="prompt-snapshot">
      {PROMPT_FIELDS.filter(({ key }) => snapshot[key]).map(({ key, label, markdown }) => (
        <details key={key} className="prompt-snapshot-item">
          <summary>{label}</summary>
          <div className="prompt-snapshot-body">
            {markdown ? (
              <MessageMarkdown content={snapshot[key]} />
            ) : (
              <pre className="prompt-snapshot-plain">{snapshot[key]}</pre>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}

export default PromptSnapshot;
