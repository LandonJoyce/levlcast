"use client";

import { useState } from "react";
import { FeedbackModal } from "./feedback-modal";

interface FeedbackButtonProps {
  label?: string;
  defaultCategory?: "general" | "failure" | "bug" | "feature_request";
  context?: Record<string, unknown> | null;
  trigger?: string;
  style?: "primary" | "secondary" | "subtle" | "link";
  className?: string;
}

export function FeedbackButton({
  label = "Send feedback",
  defaultCategory = "general",
  context = null,
  trigger,
  style = "subtle",
  className,
}: FeedbackButtonProps) {
  const [open, setOpen] = useState(false);

  const baseStyle: React.CSSProperties =
    style === "primary"
      ? {
          background: "linear-gradient(135deg, #FF5800, #F26179)",
          color: "#fff",
          border: "none",
          padding: "10px 16px",
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
        }
      : style === "secondary"
      ? {
          background: "rgba(255,255,255,0.06)",
          color: "#ECF1FA",
          border: "1px solid rgba(255,255,255,0.1)",
          padding: "10px 16px",
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }
      : style === "link"
      ? {
          background: "none",
          border: "none",
          color: "#A6B3C9",
          padding: 0,
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          textDecoration: "underline",
          textUnderlineOffset: 3,
        }
      : {
          background: "rgba(155,106,255,0.1)",
          color: "#C9B3FF",
          border: "1px solid rgba(155,106,255,0.3)",
          padding: "8px 14px",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={baseStyle} className={className}>
        {label}
      </button>
      <FeedbackModal
        isOpen={open}
        onClose={() => setOpen(false)}
        defaultCategory={defaultCategory}
        context={context}
        trigger={trigger}
      />
    </>
  );
}
