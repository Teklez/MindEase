import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
      <div className="max-w-lg text-center">
        <h1 className="text-2xl font-semibold text-foreground">Privacy Policy</h1>
        <p className="mt-4 text-muted-foreground">This page is a placeholder. Privacy policy content coming soon.</p>
        <Link href="/" className="mt-6 inline-block text-primary hover:underline">
          Back to home
        </Link>
      </div>
    </div>
  );
}
