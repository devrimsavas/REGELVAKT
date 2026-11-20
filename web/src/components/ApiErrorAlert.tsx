import { Alert, Heading, Paragraph } from "@digdir/designsystemet-react";
import { getTranslations } from "next-intl/server";
import type { ApiError } from "@/lib/apiErrors";

// What went wrong with an API call, in the user's words
export async function ApiErrorAlert({
  error,
  title,
}: {
  error: ApiError;
  title?: string;
}) {
  const t = await getTranslations("apiErrors");
  return (
    <Alert data-color={error.key === "unexpected" ? "danger" : "warning"}>
      {title && (
        <Heading level={2} data-size="xs">
          {title}
        </Heading>
      )}
      <Paragraph>{t(error.key, { minutes: error.minutes ?? 1 })}</Paragraph>
    </Alert>
  );
}
