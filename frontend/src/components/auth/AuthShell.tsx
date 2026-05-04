import BrandPanel from "./BrandPanel";

type Props = {
  brand: {
    headlineLead: string;
    headlineEm: string;
    subcopy: string;
    caption: string;
  };
  children: React.ReactNode;
};

export default function AuthShell({ brand, children }: Props) {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <BrandPanel
        headlineLead={brand.headlineLead}
        headlineEm={brand.headlineEm}
        subcopy={brand.subcopy}
        caption={brand.caption}
      />
      <main className="flex items-center justify-center bg-background px-6 py-12 md:px-10 lg:px-16">
        <div className="w-full max-w-[440px]">{children}</div>
      </main>
    </div>
  );
}
