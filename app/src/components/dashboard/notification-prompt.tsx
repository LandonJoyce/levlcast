"use client";

import { useEffect, useState } from "react";

export function NotificationPrompt() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      Notification.permission !== "default"
    ) return;

    // Only show if we haven't dismissed it before
    if (localStorage.getItem("notif-dismissed")) return;

    setShow(true);
  }, []);

  async function enable() {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setShow(false); return; }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as unknown as ArrayBuffer,
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });

      setShow(false);
    } catch (err) {
      console.error("[push] subscribe failed:", err);
      setShow(false);
    } finally {
      setLoading(false);
    }
  }

  function dismiss() {
    localStorage.setItem("notif-dismissed", "1");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 12, padding: "10px 16px",
      background: "color-mix(in oklab, var(--blue-soft) 40%, var(--surface-2))",
      border: "1px solid color-mix(in oklab, var(--blue) 25%, var(--line))",
      borderRadius: 10, marginBottom: 16,
      flexWrap: "wrap",
    }}>
      <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
        Get notified in your browser when your stream analysis is done.
      </span>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          onClick={dismiss}
          style={{ fontSize: 12, color: "var(--ink-3)", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}
        >
          Not now
        </button>
        <button
          onClick={enable}
          disabled={loading}
          style={{
            fontSize: 12, fontWeight: 600, color: "var(--blue)",
            background: "color-mix(in oklab, var(--blue) 12%, transparent)",
            border: "1px solid color-mix(in oklab, var(--blue) 30%, var(--line))",
            borderRadius: 6, cursor: "pointer", padding: "4px 12px",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Enabling…" : "Enable notifications"}
        </button>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
