export const metadata = {
  title: "LevlCast — Back soon",
};

export default function MaintenancePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0f",
        color: "#e5e5ea",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        padding: "24px",
      }}
    >
      <div style={{ maxWidth: 480, textAlign: "center" }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "0.02em",
            color: "#a78bfa",
            marginBottom: 24,
          }}
        >
          LevlCast
        </div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            marginBottom: 16,
            lineHeight: 1.3,
          }}
        >
          Quick maintenance — back shortly
        </h1>
        <p
          style={{
            fontSize: 16,
            lineHeight: 1.6,
            color: "#a1a1aa",
            marginBottom: 12,
          }}
        >
          We&apos;re fixing an issue with VOD analysis. Nothing on your
          account is affected — your VODs, clips, and reports are all safe.
        </p>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: "#a1a1aa" }}>
          Everyone gets a free day of Pro to make up for the downtime.
          Thanks for bearing with us.
        </p>
      </div>
    </div>
  );
}
