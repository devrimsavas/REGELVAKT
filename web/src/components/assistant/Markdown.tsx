import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import styles from "./assistant.module.css";

// Web links and links within the page are kept; anything else
// (javascript:, data:, ...) is removed. react-markdown never runs HTML
// from the text: it is shown as plain text, so an answer from the model
// cannot put a script on the page.
function safeUrl(url: string): string {
  if (/^#[\w-]+$/.test(url)) return url;
  const cleaned = defaultUrlTransform(url);
  return /^https?:\/\//i.test(cleaned) ? cleaned : "";
}

// The model's answer: short paragraphs, lists and bold text
export function Markdown({ text }: { text: string }) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={safeUrl}
        components={{
          a: ({ href, children }) =>
            !href ? (
              <span>{children}</span>
            ) : href.startsWith("#") ? (
              // A source number, linking to the source below the answer
              <a href={href} className={styles.citation}>
                {children}
              </a>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
          img: () => null,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
