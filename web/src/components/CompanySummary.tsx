import { Heading, Paragraph, Tag } from "@digdir/designsystemet-react";
import { getTranslations } from "next-intl/server";
import { formatOrgNumber } from "@/lib/orgNumber";
import type { Company } from "@/lib/types";
import styles from "./CompanySummary.module.css";

// The company's name and the register facts the rules depend on
export async function CompanySummary({
  company,
  headingLevel = 1,
}: {
  company: Company;
  headingLevel?: 1 | 2;
}) {
  const t = await getTranslations("company");
  const place = company.address?.municipality ?? company.address?.city;

  return (
    <div className={styles.summary}>
      <Heading level={headingLevel} data-size={headingLevel === 1 ? "lg" : "md"}>
        {company.name}
      </Heading>
      <Paragraph className={styles.facts}>
        {[
          t("orgNumber", { orgNumber: formatOrgNumber(company.orgNumber) }),
          company.organizationFormDescription,
          place,
        ]
          .filter(Boolean)
          .join(" · ")}
      </Paragraph>
      <div className={styles.tags}>
        <Tag data-color={company.vatRegistered ? "info" : "neutral"}>
          {t(company.vatRegistered ? "vatRegistered" : "notVatRegistered")}
        </Tag>
        {company.isBankrupt && <Tag data-color="danger">{t("bankrupt")}</Tag>}
        {company.isUnderForcedLiquidation && (
          <Tag data-color="danger">{t("forcedLiquidation")}</Tag>
        )}
        {company.isUnderLiquidation && (
          <Tag data-color="warning">{t("liquidation")}</Tag>
        )}
      </div>
    </div>
  );
}
