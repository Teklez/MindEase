import { getTranslations } from "next-intl/server";
import AuthShell from "@/components/auth/AuthShell";
import LoginForm from "@/components/auth/LoginForm";

export default async function LoginPage() {
  const t = await getTranslations("auth.login.brand");
  return (
    <AuthShell
      brand={{
        headlineLead: t("headlineLead"),
        headlineEm: t("headlineEm"),
        subcopy: t("subcopy"),
        caption: t("caption"),
      }}
    >
      <LoginForm />
    </AuthShell>
  );
}
