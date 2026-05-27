import { getTranslations } from "next-intl/server";
import BrandPanel from "@/components/auth/BrandPanel";
import RegisterForm from "@/components/auth/RegisterForm";

// TODO: replace Unsplash hotlink with approved imagery in public/auth/register-bg.jpg before launch.
const REGISTER_PHOTO =
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1400&q=75";

export default async function RegisterPage() {
  const t = await getTranslations("auth.v2.register.brand");

  return (
    <div className="grid min-h-screen overflow-auto lg:grid-cols-2">
      <BrandPanel
        photoSrc={REGISTER_PHOTO}
        eyebrow={t("eyebrow")}
        headlineLead={t("headlineLead")}
        headlineEm={t("headlineEm")}
        subcopy={t("subcopy")}
      />

      <section className="relative flex flex-col overflow-y-auto bg-background px-6 py-8 sm:px-10 md:px-14 lg:px-14 lg:py-10">
        <div className="my-auto w-full self-center py-8">
          <RegisterForm />
        </div>
      </section>
    </div>
  );
}
