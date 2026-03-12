import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
      <div className="max-w-lg text-center">
        <h1 className="text-2xl font-semibold text-foreground">Terms of Service</h1>
        <p className="mt-4 text-muted-foreground">This page is a placeholder. Terms of service content coming soon.</p>
        <Link href="/" className="mt-6 inline-block text-primary hover:underline">
          Back to home
        </Link>
      </div>
    </div>
  );
}
