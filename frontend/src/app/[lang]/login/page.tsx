"use client";

import { PublicShell } from "@/components/shell/PublicShell";
import { Reveal } from "@/components/motion/Reveal";
import { LoginForm } from "@/components/LoginForm";
import { PipelinePreview } from "@/components/PipelinePreview";
import { useI18n } from "@/i18n/LocaleProvider";

export default function LoginPage() {
  const { dict } = useI18n();

  return (
    <PublicShell>
      <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-2 lg:gap-16 lg:py-20">
        <Reveal className="flex flex-col items-center">
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-[var(--shadow-card)]">
            <div className="text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{dict.auth.loginTitle}</h1>
              <p className="mt-2 text-sm text-text-secondary">{dict.auth.loginSubtitle}</p>
            </div>
            <div className="mt-6">
              <LoginForm />
            </div>
          </div>
        </Reveal>

        <Reveal variant="fade" delay={0.08} className="hidden lg:order-first lg:flex lg:flex-col lg:justify-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">{dict.auth.sidebarEyebrow}</p>
          <p className="mt-3 max-w-md text-3xl font-semibold tracking-tight text-text-primary">
            {dict.auth.loginSidebarHeading}
          </p>
          <p className="mt-4 max-w-sm text-text-secondary">{dict.auth.loginSidebarBody}</p>
          <div className="mt-10 max-w-md">
            <PipelinePreview />
          </div>
        </Reveal>
      </div>
    </PublicShell>
  );
}
