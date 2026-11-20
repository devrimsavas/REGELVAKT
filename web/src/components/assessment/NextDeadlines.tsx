import {
  Link,
  Paragraph,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@digdir/designsystemet-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { IsoDate } from "@/lib/dates";
import { nextDeadlines } from "@/lib/deadlines";
import { pick } from "@/lib/localized";
import type { Obligation } from "@/lib/types";
import { DeadlineDate } from "./DeadlineDate";

// How many deadlines the overview shows; each obligation lists all of its
// own further down
const SHOWN = 6;

export async function NextDeadlines({
  obligations,
  today,
}: {
  obligations: Obligation[];
  today: IsoDate;
}) {
  const t = await getTranslations("assessment");
  const locale = await getLocale();
  const rows = nextDeadlines(obligations, SHOWN);

  if (rows.length === 0) return <Paragraph>{t("nextEmpty")}</Paragraph>;

  return (
    <Table zebra>
      <TableHead>
        <TableRow>
          <TableHeaderCell>{t("deadlineColumn")}</TableHeaderCell>
          <TableHeaderCell>{t("obligationColumn")}</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map(({ date, obligation }) => (
          <TableRow key={`${date}-${obligation.id}`}>
            <TableCell>
              <DeadlineDate date={date} today={today} />
            </TableCell>
            <TableCell>
              <Link href={`#obligation-${obligation.id}`}>
                {pick(obligation.title, locale)}
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
