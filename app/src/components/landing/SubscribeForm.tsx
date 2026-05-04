"use client";
import { useState } from "react";

export default function SubscribeForm() {
  const [done, setDone] = useState(false);
  const [email, setEmail] = useState("");

  return (
    <form
      className="ll-subscribe"
      onSubmit={(e) => { e.preventDefault(); if (email) setDone(true); }}
    >
      {done ? (
        <span style={{ padding: "10px 12px", fontSize: 13, color: "rgb(30,235,139)" }}>Subscribed!</span>
      ) : (
        <>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit">Subscribe</button>
        </>
      )}
    </form>
  );
}
