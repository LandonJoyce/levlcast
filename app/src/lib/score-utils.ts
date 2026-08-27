export function scoreColorVar(n: number): string {
  if (n >= 80) return "var(--green)";
  if (n >= 60) return "var(--blue)";
  if (n >= 40) return "var(--warn)";
  return "var(--danger)";
}

export function scoreColorHex(n: number): string {
  if (n >= 80) return "#74e0a8";
  if (n >= 60) return "#5da3ff";
  if (n >= 40) return "#e8c970";
  return "#e26060";
}

export interface RankInfo {
  label: string;
  cls: "fresh" | "rising" | "consist" | "crowd" | "elite" | "legend";
}

export function rankFor(n: number): RankInfo {
  if (n >= 90) return { label: "LevlCast Legend",    cls: "legend"  };
  if (n >= 80) return { label: "Elite Entertainer",  cls: "elite"   };
  if (n >= 70) return { label: "Crowd Favorite",     cls: "crowd"   };
  if (n >= 55) return { label: "Consistent Creator", cls: "consist" };
  if (n >= 40) return { label: "Rising Talent",      cls: "rising"  };
  return        { label: "Fresh Streamer",          cls: "fresh"   };
}
