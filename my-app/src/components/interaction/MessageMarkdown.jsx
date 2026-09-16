import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./messageMarkdown.css";

export default function MessageMarkdown({ content }) {
  const text = typeof content === "string" ? content : "";

  return (
    <div className="message-text message-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
              {children}
            </a>
          ),
          pre: ({ children, ...props }) => (
            <pre className="message-md-pre" {...props}>
              {children}
            </pre>
          ),
          code: ({ className, children, ...props }) => {
            const isFenced = Boolean(/language-/.exec(className || ""));
            const text = String(children ?? "");
            const isIndentedBlock = text.includes("\n");
            if (isFenced || isIndentedBlock) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }
            const inlineClass = ["message-md-inline-code", className].filter(Boolean).join(" ");
            return (
              <code className={inlineClass} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
