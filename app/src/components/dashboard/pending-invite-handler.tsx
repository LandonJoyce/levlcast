"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PENDING_INVITE_KEY } from "@/components/landing/invite-action";

/**
 * Finishes a duel or friend-league invite after sign-in.
 *
 * Someone who opens an invite signed out is sent through Twitch sign-in,
 * and OAuth drops everything on the way back. The invite waits in
 * localStorage instead, and this accepts it on the first dashboard page
 * they reach. If it can't (the link was taken or cancelled meanwhile),
 * it sends them back to the invite page, which says why.
 */
export function PendingInviteHandler() {
  const router = useRouter();

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(PENDING_INVITE_KEY);
      if (raw) localStorage.removeItem(PENDING_INVITE_KEY);
    } catch {
      return;
    }
    if (!raw) return;

    let invite: { kind?: string; code?: string } = {};
    try {
      invite = JSON.parse(raw);
    } catch {
      return;
    }
    const code = typeof invite.code === "string" && /^[a-z0-9]{4,16}$/.test(invite.code) ? invite.code : null;
    if (!code || (invite.kind !== "duel" && invite.kind !== "league")) return;

    const url = invite.kind === "duel" ? `/api/duels/${code}/accept` : `/api/friend-leagues/${code}/join`;
    const page = invite.kind === "duel" ? `/duel/${code}` : `/join/${code}`;
    fetch(url, { method: "POST" })
      .then((res) => (res.ok ? router.refresh() : router.push(page)))
      .catch(() => router.push(page));
  }, [router]);

  return null;
}
