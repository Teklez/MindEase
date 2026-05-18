import { getTranslations } from "next-intl/server";
import BrandPanel from "@/components/auth/BrandPanel";
import FormPanelTop from "@/components/auth/FormPanelTop";
import FormFoot from "@/components/auth/FormFoot";
import LoginForm from "@/components/auth/LoginForm";

// TODO: replace Unsplash hotlink with approved imagery in public/auth/login-bg.jpg before launch.
const LOGIN_PHOTO =
  "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&w=1400&q=75";

export default async function LoginPage() {
  const t = await getTranslations("auth.v2.login.brand");

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <BrandPanel
        photoSrc={LOGIN_PHOTO}
        eyebrow={t("eyebrow")}
        headlineLead={t("headlineLead")}
        headlineEm={t("headlineEm")}
        subcopy={t("subcopy")}
        quote={{
          text: t("quote"),
          attribution: t("attribution"),
          avatar: t("avatar"),
        }}
        footStart={<span>{t("copyright")}</span>}
      />

      <section className="relative flex flex-col bg-background px-6 py-8 sm:px-10 md:px-14 lg:px-14 lg:py-10">
        <FormPanelTop />
        <div className="my-auto w-full self-center py-8">
          <LoginForm />
        </div>
        <FormFoot />
      </section>
    </div>
  );
}
