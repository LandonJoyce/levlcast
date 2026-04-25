"use client";

import { usePathname } from "next/navigation";
import { Fragment } from "react";

const Icons = {
  Search: () => (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  Bell: () => (
    <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
      <path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M10 18a2 2 0 004 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  Plus: () => (
    <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
};

export default function DashTopbar() {
  const pathname = usePathname();

  // Build breadcrumbs from pathname
  const crumbs: string[] = ["Workspace"];
  if (pathname === "/dashboard") {
    crumbs.push("Dashboard");
  } else if (pathname.startsWith("/dashboard/vods/")) {
    crumbs.push("VODs", "Report");
  } else if (pathname.startsWith("/dashboard/vods")) {
    crumbs.push("VODs");
  } else if (pathname.startsWith("/dashboard/clips")) {
    crumbs.push("Clips");
  } else if (pathname.startsWith("/dashboard/settings")) {
    crumbs.push("Account");
  } else if (pathname.startsWith("/dashboard/connections")) {
    crumbs.push("Account", "Connections");
  } else {
    crumbs.push("Dashboard");
  }

  return (
    <div className="topbar">
      <div className="crumb">
        {crumbs.map((c, i) => (
          <Fragment key={i}>
            {i > 0 && <span style={{ opacity: 0.5 }}>/</span>}
            <b>{c}</b>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
