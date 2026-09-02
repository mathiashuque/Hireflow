"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useI18n } from "@/i18n/LocaleProvider";
import { stripLocale } from "@/i18n/routing";

type WorkspaceNavProps = {
  workspaceId: string;
};

export function WorkspaceNav({ workspaceId }: WorkspaceNavProps) {
  const pathname = usePathname();
  const { dict, href } = useI18n();
  const localeFreePathname = pathname ? stripLocale(pathname) : "";

  const overviewPath = `/workspaces/${workspaceId}`;
  const jobsPath = `/workspaces/${workspaceId}/jobs`;
  const membersPath = `/workspaces/${workspaceId}/members`;

  const isJobs = localeFreePathname.startsWith(jobsPath);
  const isMembers = localeFreePathname.startsWith(membersPath);
  const isOverview = !isJobs && !isMembers;

  return (
    <nav aria-label={dict.a11y.workspaceNav} className="-mx-1 overflow-x-auto">
      <div className="flex min-w-max gap-1 border-b border-border px-1">
        <Tab href={href(overviewPath)} label={dict.nav.workspaceOverview} active={isOverview} />
        <Tab href={href(jobsPath)} label={dict.nav.workspaceJobs} active={isJobs} />
        <Tab href={href(membersPath)} label={dict.nav.workspaceMembers} active={isMembers} />
      </div>
    </nav>
  );
}

function Tab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="relative px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span className={active ? "text-text-primary" : "text-text-muted hover:text-text-secondary"}>{label}</span>
      {active ? (
        <motion.span
          layoutId="workspace-nav-indicator"
          className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-text-primary"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
      ) : null}
    </Link>
  );
}
