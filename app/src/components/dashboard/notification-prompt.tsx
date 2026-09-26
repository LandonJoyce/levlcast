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
    <div className="np">
      <p>Want a ping in your browser when the report is done?</p>
      <div className="np-actions">
        <button type="button" className="np-no" onClick={dismiss}>
          No thanks
        </button>
        <button type="button" className="btn btn-ghost gen-clip" onClick={enable} disabled={loading}>
          {loading ? "Turning on..." : "Turn on"}
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
