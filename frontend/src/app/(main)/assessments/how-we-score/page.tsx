import Link from "next/link";
import { ArrowLeft, Brain, HeartPulse, Activity, Info } from "lucide-react";

interface Range {
  min: number;
  max: number;
  label: string;
  description: string;
  color: string;
}

interface Instrument {
  name: string;
  code: string;
  type: string;
  icon: React.ElementType;
  tone: "sage" | "honey" | "dawn";
  questions: number;
  maxScore: number;
  responseScale: string;
  about: string;
  ranges: Range[];
}

const INSTRUMENTS: Instrument[] = [
  {
    name: "Anxiety Screening",
    code: "GAD-7",
    type: "anxiety",
    icon: HeartPulse,
    tone: "honey",
    questions: 7,
    maxScore: 21,
    responseScale: "Each question is scored 0 (Not at all) to 3 (Nearly every day). Scores are summed.",
    about:
      "The Generalized Anxiety Disorder scale (GAD-7) is a validated 7-item self-report tool developed by Spitzer et al. (2006). It screens for generalized anxiety disorder and is widely used in clinical and research settings.",
    ranges: [
      { min: 0, max: 4, label: "Minimal", description: "Anxiety is minimal. Continue healthy habits and self-care.", color: "var(--lvl-1)" },
      { min: 5, max: 9, label: "Mild", description: "Mild anxiety. Relaxation techniques and mindfulness can help.", color: "var(--lvl-2)" },
      { min: 10, max: 14, label: "Moderate", description: "Moderate anxiety. Active coping strategies are recommended; consider speaking with a professional.", color: "var(--lvl-3)" },
      { min: 15, max: 21, label: "Severe", description: "Severe anxiety. Professional support is strongly encouraged.", color: "var(--lvl-5)" },
    ],
  },
  {
    name: "Depression Screening",
    code: "PHQ-9",
    type: "depression",
    icon: Brain,
    tone: "sage",
    questions: 9,
    maxScore: 27,
    responseScale: "Each question is scored 0 (Not at all) to 3 (Nearly every day). Scores are summed.",
    about:
      "The Patient Health Questionnaire (PHQ-9) is a validated 9-item self-report tool developed by Kroenke et al. (2001). It is one of the most widely used instruments for screening, diagnosing, monitoring, and measuring the severity of depression.",
    ranges: [
      { min: 0, max: 4, label: "Minimal", description: "Minimal depression. Maintain healthy habits.", color: "var(--lvl-1)" },
      { min: 5, max: 9, label: "Mild", description: "Mild depression. Staying active, social connection, and self-care help.", color: "var(--lvl-2)" },
      { min: 10, max: 14, label: "Moderate", description: "Moderate depression. Support options including professional help are recommended.", color: "var(--lvl-3)" },
      { min: 15, max: 19, label: "Moderately Severe", description: "Moderately severe depression. Speaking with a mental health professional is strongly encouraged.", color: "var(--lvl-4)" },
      { min: 20, max: 27, label: "Severe", description: "Severe depression. Please reach out to a mental health professional or crisis line.", color: "var(--lvl-5)" },
    ],
  },
  {
    name: "Stress Assessment",
    code: "PSS",
    type: "stress",
    icon: Activity,
    tone: "dawn",
    questions: 10,
    maxScore: 28,
    responseScale: "Questions are scored 0–4. Some items are reverse-scored. Scores are summed.",
    about:
      "The Perceived Stress Scale (PSS) was developed by Cohen et al. (1983) and measures the degree to which situations in one's life are appraised as stressful. MindEase uses a 10-item version.",
    ranges: [
      { min: 0, max: 7, label: "Low", description: "Low stress. You appear to be managing well.", color: "var(--lvl-1)" },
      { min: 8, max: 14, label: "Moderate", description: "Moderate stress. Adding relaxation practices to your routine can help.", color: "var(--lvl-3)" },
      { min: 15, max: 21, label: "High", description: "High stress. Prioritising stress management and professional support is advisable.", color: "var(--lvl-4)" },
      { min: 22, max: 28, label: "Very High", description: "Very high stress. Chronic high stress affects both mental and physical health — please consider reaching out.", color: "var(--lvl-5)" },
    ],
  },
];

const TONE_CLASSES = {
  sage: { icon: "bg-secondary text-primary-deep", bar: "bg-primary/20" },
  honey: { icon: "bg-honey-soft text-honey-deep", bar: "bg-honey/20" },
  dawn: { icon: "bg-dawn-soft text-dawn-deep", bar: "bg-dawn/20" },
};

export default function HowWeScorePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-7 md:py-12">
      {/* Back */}
      <Link
        href="/assessments"
        className="mb-8 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" strokeWidth={1.75} />
        Back to assessments
      </Link>

      {/* Header */}
      <header className="border-b border-border pb-7">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
          — Scoring methodology
        </p>
        <h1 className="mt-2 font-serif text-[28px] leading-tight tracking-tight text-foreground md:text-[36px]">
          How we{" "}
          <em className="text-primary-deep">score</em> your results
        </h1>
        <p className="mt-3 max-w-[54ch] text-[14.5px] leading-relaxed text-muted-foreground">
          MindEase uses three clinically validated, freely available self-report instruments. Here is exactly how each one works and what each score range means.
        </p>
      </header>

      {/* Instruments */}
      <div className="mt-8 flex flex-col gap-10">
        {INSTRUMENTS.map((inst) => {
          const Icon = inst.icon;
          const tc = TONE_CLASSES[inst.tone];
          return (
            <section key={inst.code} className="rounded-xl border border-border bg-card">
              {/* Instrument header */}
              <div className="flex items-start gap-4 border-b border-border p-5 md:p-6">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-md ${tc.icon}`}>
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h2 className="font-serif text-[20px] leading-snug tracking-tight text-foreground">
                      {inst.name}
                    </h2>
                    <span className="rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {inst.code}
                    </span>
                  </div>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
                    {inst.about}
                  </p>
                </div>
              </div>

              {/* Meta strip */}
              <div className="flex flex-wrap gap-5 border-b border-border px-5 py-3.5 md:px-6">
                <MetaItem label="Questions" value={inst.questions.toString()} />
                <MetaItem label="Max score" value={inst.maxScore.toString()} />
                <MetaItem label="Response scale" value={inst.responseScale} wide />
              </div>

              {/* Score ranges */}
              <div className="p-5 md:p-6">
                <p className="mb-4 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                  Score ranges
                </p>
                <div className="flex flex-col gap-3">
                  {inst.ranges.map((r) => (
                    <div key={r.label} className="flex items-start gap-3">
                      {/* Score badge */}
                      <span
                        className="mt-0.5 shrink-0 rounded-md px-2.5 py-1 font-mono text-[11px] font-medium tabular-nums"
                        style={{
                          background: `color-mix(in oklab, ${r.color} 14%, transparent)`,
                          color: r.color,
                          border: `1px solid color-mix(in oklab, ${r.color} 28%, transparent)`,
                          minWidth: "3.5rem",
                          textAlign: "center",
                        }}
                      >
                        {r.min}–{r.max}
                      </span>
                      <div>
                        <span className="text-[13.5px] font-medium text-foreground">{r.label}</span>
                        <span className="text-[13.5px] text-muted-foreground"> — {r.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* Disclaimer */}
      <div className="mt-8 flex gap-3 rounded-lg border border-border bg-muted/40 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          These tools are <strong className="font-medium text-foreground">screening instruments, not clinical diagnoses</strong>. Scores help identify patterns and prompt helpful conversations — they are not a substitute for professional assessment. If you are in distress, please contact a mental health professional or call a crisis line.
        </p>
      </div>
    </div>
  );
}

function MetaItem({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "min-w-0 flex-1" : undefined}>
      <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[13px] text-foreground">{value}</p>
    </div>
  );
}
