import { useTranslations } from "next-intl";

export default function DisclaimerStrip() {
  const t = useTranslations("landing.v3");
  return (
    <div className="bg-foreground py-[9px] text-center text-[12.5px] tracking-[0.005em] text-background/85">
      <span className="mr-2.5 inline-block h-[5px] w-[5px] translate-y-[2px] rounded-full bg-primary align-middle" />
      {t("disclaimer")}
    </div>
  );
}
