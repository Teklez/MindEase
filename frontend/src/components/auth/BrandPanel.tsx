import Logo from "@/components/shared/Logo";

type Props = {
  headlineLead: string;
  headlineEm: string;
  subcopy: string;
  caption: string;
};

export default function BrandPanel({ headlineLead, headlineEm, subcopy, caption }: Props) {
  return (
    <aside
      className="relative hidden md:flex md:flex-col md:justify-between overflow-hidden text-background"
      aria-hidden={false}
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, hsl(150 30% 30%) 0%, hsl(160 24% 18%) 60%, hsl(160 18% 10%) 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, hsl(0 0% 100% / 0.6) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "linear-gradient(180deg, hsl(160 24% 12% / 0) 0%, hsl(160 24% 8% / 0.6) 100%)",
        }}
      />

      <div className="relative px-10 pt-10 lg:px-16 lg:pt-12">
        <Logo size="md" asLink={false} variant="light" href="/" />
      </div>

      <div className="relative px-10 pb-12 lg:px-16 lg:pb-16">
        <h2 className="font-serif text-[40px] leading-[1.06] tracking-tight text-background lg:text-[52px]">
          {headlineLead} <em className="text-primary">{headlineEm}</em>
        </h2>
        <p className="mt-6 max-w-md text-[15px] leading-relaxed text-background/80">{subcopy}</p>
        <p className="mt-10 text-xs uppercase tracking-[0.2em] text-background/60">{caption}</p>
      </div>
    </aside>
  );
}
