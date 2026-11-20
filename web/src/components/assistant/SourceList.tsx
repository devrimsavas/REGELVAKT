import { Link, Paragraph, Tag } from "@digdir/designsystemet-react";
import { ExternalLinkIcon } from "@navikt/aksel-icons";
import { useTranslations } from "next-intl";
import { type Source, sourceAnchor } from "@/lib/assistant";
import styles from "./assistant.module.css";

// The numbered sources of one answer: Regelvakt's rules first, then the
// sections of the official pages, with the ones the answer used marked
export function SourceList({
  sources,
  prefix,
  showCited,
}: {
  sources: Source[];
  prefix: string;
  showCited: boolean;
}) {
  const t = useTranslations("assistant");
  const footer = useTranslations("footer");

  return (
    <ol className={styles.sources}>
      {sources.map((source) => (
        <li
          key={source.number}
          id={sourceAnchor(prefix, source.number)}
          className={styles.source}
        >
          <span className={styles.number} aria-hidden>
            {source.number}
          </span>
          <div className={styles.sourceBody}>
            {source.url ? (
              <Link href={source.url} target="_blank" rel="noreferrer">
                {source.title} – {source.heading}
                <ExternalLinkIcon aria-hidden />
                <span className="visually-hidden">
                  {" "}
                  {footer("opensInNewTab")}
                </span>
              </Link>
            ) : (
              <strong>
                {source.title} – {source.heading}
              </strong>
            )}
            <Paragraph data-size="sm" className={styles.excerpt}>
              {source.kind === "rules" ? t("rulesSource") : source.excerpt}
            </Paragraph>
            {showCited && source.cited && (
              <Tag data-color="success" data-size="sm">
                {t("cited")}
              </Tag>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
