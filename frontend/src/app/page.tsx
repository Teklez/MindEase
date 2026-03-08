import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-white">
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="text-4xl sm:text-5xl font-semibold text-slate-800 tracking-tight">
          Your AI Mental Health Companion
        </h1>
        <p className="mt-4 max-w-md text-lg text-slate-600">
          A calm space for reflection and support. MindEase is here to listen and help you find clarity.
        </p>
        <div className="mt-10 flex flex-wrap gap-4 justify-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-white font-medium hover:bg-primary-dark transition-colors shadow-sm"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg border border-primary/40 bg-white px-6 py-3 text-primary font-medium hover:bg-primary/5 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </main>
      <footer className="py-6 px-6 text-center text-sm text-slate-500 border-t border-slate-200/60">
        <p>
          MindEase provides supportive tools only and is not a substitute for professional therapy or medical advice.
        </p>
      </footer>
    </div>
  );
}
