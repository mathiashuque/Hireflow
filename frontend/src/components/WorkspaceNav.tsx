"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type WorkspaceNavProps = {
  workspaceId: string;
};

export function WorkspaceNav({ workspaceId }: WorkspaceNavProps) {
  const pathname = usePathname();
  const overviewHref = `/workspaces/${workspaceId}`;
  const jobsHref = `/workspaces/${workspaceId}/jobs`;
  const membersHref = `/workspaces/${workspaceId}/members`;
  const isJobs = pathname?.startsWith(jobsHref) ?? false;
  const isMembers = pathname?.startsWith(membersHref) ?? false;
  const isOverview = !isJobs && !isMembers;

  return (
    <nav aria-label="Workspace" className="flex gap-1 border-b border-slate-200">
      <Tab href={overviewHref} label="Overview" active={isOverview} />
      <Tab href={jobsHref} label="Jobs" active={isJobs} />
      <Tab href={membersHref} label="Members" active={isMembers} />
    </nav>
  );
}

function Tab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`border-b-2 px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
        active
          ? "border-slate-900 text-slate-950"
          : "border-transparent text-slate-500 hover:text-slate-800"
      }`}
    >
      {label}
    </Link>
  );
}
