import Link from "next/link";
import { getTranslations } from "next-intl/server";
import RegisterForm from "@/components/auth/RegisterForm";

export default async function RegisterPage() {
  const t = await getTranslations("auth.register");
  return (
    <div className="w-full flex flex-col items-center">
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t("signIn")}
        </Link>
      </p>
    </div>
  );
}
