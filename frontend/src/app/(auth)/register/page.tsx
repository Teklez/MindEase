import { getTranslations } from "next-intl/server";
import AuthShell from "@/components/auth/AuthShell";
import RegisterForm from "@/components/auth/RegisterForm";

export default async function RegisterPage() {
  const t = await getTranslations("auth.register.brand");
  return (
    <AuthShell
      brand={{
        headlineLead: t("headlineLead"),
        headlineEm: t("headlineEm"),
        subcopy: t("subcopy"),
        caption: t("caption"),
      }}
    >
      <RegisterForm />
    </AuthShell>
  );
}
