import * as motion from "motion/react-client";
import { PublicShell } from "@/components/shell/PublicShell";
import { Reveal } from "@/components/motion/Reveal";
import { PipelinePreview } from "@/components/PipelinePreview";
import { staggerContainer, staggerItem } from "@/lib/motion";

const features = [
  {
    title: "Isolated team workspaces",
    description: "Every team gets its own workspace with strict membership boundaries.",
  },
  {
    title: "Jobs and candidate pipelines",
    description: "Track openings from draft to close, and candidates from applied to offer.",
  },
  {
    title: "Role-aware collaboration",
    description: "Owners, recruiters, and interviewers each see exactly what they need.",
  },
];

export default function Home() {
  return (
    <PublicShell>
      <section className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
        <Reveal>
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-brand">
            Hiring, without the clutter
          </p>
          <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-text-primary sm:text-6xl">
            Keep every candidate moving forward.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-text-secondary sm:text-lg">
            Hireflow gives teams one secure workspace to organize openings,
            candidates, interviews, and the decisions behind every hire.
          </p>

          <motion.ul
            initial="hidden"
            animate="show"
            variants={staggerContainer}
            className="mt-10 grid gap-3 text-sm text-text-secondary sm:grid-cols-1"
          >
            {features.map((feature) => (
              <motion.li
                key={feature.title}
                variants={staggerItem}
                className="rounded-lg border border-border bg-surface p-4 shadow-[var(--shadow-card)]"
              >
                <p className="font-medium text-text-primary">{feature.title}</p>
                <p className="mt-1 text-text-secondary">{feature.description}</p>
              </motion.li>
            ))}
          </motion.ul>
        </Reveal>

        <Reveal variant="fade" delay={0.12} className="hidden lg:block">
          <PipelinePreview />
        </Reveal>
      </section>
    </PublicShell>
  );
}
