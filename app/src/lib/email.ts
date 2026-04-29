import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Sent when the auto-sync cron detects a new VOD on Twitch for a user
 * who has analyzed at least one stream before. The whole point: bridge
 * "I streamed again" → "open LevlCast and run the report." Without
 * this email, most one-time users never come back.
 */
export async function sendNewVodEmail(
  to: string,
  name: string,
  vodTitle: string,
  vodCount: number,
  hasPriorAnalyses: boolean
): Promise<void> {
  const subject = vodCount === 1
    ? `Your latest stream is ready to analyze`
    : `${vodCount} new streams ready to analyze`;

  const headline = hasPriorAnalyses
    ? "Track the delta from last stream."
    : "Your stream is ready for its first coach report.";

  const subhead = hasPriorAnalyses
    ? "One report is a snapshot. The change between streams is where coaching actually lives — your last report set the baseline, this one shows what moved."
    : "5 minutes to a full coach report — score, peak moments, and exactly what to change next stream.";

  await resend.emails.send({
    from: "LevlCast <hello@levlcast.com>",
    to,
    subject,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#0A0A0F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0F;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <tr><td style="padding-bottom:32px;">
          <span style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">LevlCast</span>
        </td></tr>

        <tr><td style="background:#141418;border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:40px 36px;">

          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#22D3EE;">Hey ${name}</p>
          <h1 style="margin:0 0 14px;font-size:26px;font-weight:800;color:#ffffff;line-height:1.2;">${headline}</h1>
          <p style="margin:0 0 22px;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.6;">${subhead}</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a22;border-radius:14px;padding:16px 20px;margin-bottom:26px;">
            <tr><td>
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.35);">${vodCount === 1 ? "New stream" : `${vodCount} new streams · most recent`}</p>
              <p style="margin:0;font-size:15px;color:#ffffff;line-height:1.4;">${vodTitle}</p>
            </td></tr>
          </table>

          <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td style="background:#7C3AED;border-radius:12px;">
              <a href="https://levlcast.com/dashboard/vods" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">
                Analyze ${vodCount === 1 ? "It" : "Them"} →
              </a>
            </td></tr>
          </table>

          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.5;">
            We auto-detect new streams on your Twitch channel so you never have to remember to come back.
          </p>

        </td></tr>

        <tr><td style="padding-top:24px;text-align:center;">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">
            LevlCast · <a href="https://levlcast.com/dashboard/settings" style="color:rgba(255,255,255,0.2);text-decoration:underline;">Unsubscribe</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendVodReadyEmail(to: string, name: string, vodId: string, title: string, score: number | undefined, recommendation: string): Promise<void> {
  const scoreText = score !== undefined ? `${score}/100` : null;
  const snippet = recommendation.length > 120 ? recommendation.slice(0, 117) + "..." : recommendation;
  const reportUrl = `https://levlcast.com/dashboard/vods/${vodId}`;

  await resend.emails.send({
    from: "LevlCast <hello@levlcast.com>",
    to,
    subject: scoreText ? `Your stream scored ${scoreText} — report ready` : "Your stream report is ready",
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your stream report is ready</title></head>
<body style="margin:0;padding:0;background:#0A0A0F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0F;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <tr><td style="padding-bottom:32px;">
          <span style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">LevlCast</span>
        </td></tr>

        <tr><td style="background:#141418;border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:40px 36px;">

          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#a78bfa;">Hey ${name}</p>
          <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#ffffff;line-height:1.2;">Your stream report is ready.</h1>
          <p style="margin:0 0 24px;font-size:13px;color:rgba(255,255,255,0.35);">${title}</p>

          ${scoreText ? `
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a22;border-radius:14px;padding:20px 24px;margin-bottom:24px;">
            <tr>
              <td>
                <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.3);">Stream Score</p>
                <p style="margin:0;font-size:36px;font-weight:900;color:#a78bfa;">${scoreText}</p>
              </td>
            </tr>
          </table>` : ""}

          ${snippet ? `<p style="margin:0 0 28px;font-size:14px;color:rgba(255,255,255,0.55);line-height:1.6;border-left:3px solid #7C3AED;padding-left:14px;">${snippet}</p>` : ""}

          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="background:#7C3AED;border-radius:12px;">
              <a href="${reportUrl}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">
                View Full Report →
              </a>
            </td></tr>
          </table>

        </td></tr>

        <tr><td style="padding-top:24px;text-align:center;">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">
            LevlCast · <a href="https://levlcast.com/dashboard/settings" style="color:rgba(255,255,255,0.2);text-decoration:underline;">Unsubscribe</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  await resend.emails.send({
    from: "LevlCast <hello@levlcast.com>",
    to,
    subject: "Welcome to LevlCast — your first coach report is waiting",
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welcome to LevlCast</title></head>
<body style="margin:0;padding:0;background:#0A0A0F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0F;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <tr><td style="padding-bottom:32px;">
          <span style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">LevlCast</span>
        </td></tr>

        <tr><td style="background:#141418;border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:40px 36px;">

          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#22D3EE;">Welcome, ${name}</p>
          <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#ffffff;line-height:1.2;">Your Twitch coach is ready.</h1>
          <p style="margin:0 0 28px;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.6;">
            LevlCast analyzes your streams and tells you exactly what to improve — score, peak clip moments, and a personalized recommendation every time you go live.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.06);padding:20px 0;margin-bottom:28px;">
            <tr><td style="padding:10px 0;">
              <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#ffffff;">1. Sync your streams</p>
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);">We pull your recent VODs from Twitch automatically.</p>
            </td></tr>
            <tr><td style="padding:10px 0;">
              <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#ffffff;">2. Run your first analysis</p>
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);">Takes about 5 minutes. We transcribe, score, and find your best moments.</p>
            </td></tr>
            <tr><td style="padding:10px 0;">
              <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#ffffff;">3. Get your coach report</p>
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);">Stream score, what you're doing well, and one thing to change next time.</p>
            </td></tr>
          </table>

          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#7C3AED;border-radius:12px;">
              <a href="https://levlcast.com/dashboard/vods" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">
                Analyze My First Stream →
              </a>
            </td></tr>
          </table>

        </td></tr>

        <tr><td style="padding-top:24px;text-align:center;">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">
            LevlCast · <a href="https://levlcast.com/dashboard/settings" style="color:rgba(255,255,255,0.2);text-decoration:underline;">Unsubscribe</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendActivationEmail(to: string, name: string): Promise<void> {
  await resend.emails.send({
    from: "LevlCast <hello@levlcast.com>",
    to,
    subject: "Your first stream analysis is waiting",
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your stream report is waiting</title></head>
<body style="margin:0;padding:0;background:#0A0A0F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0F;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <!-- Logo -->
        <tr><td style="padding-bottom:32px;">
          <span style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">LevlCast</span>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#141418;border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:40px 36px;">

          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#a78bfa;">Hey ${name}</p>
          <h1 style="margin:0 0 16px;font-size:26px;font-weight:800;color:#ffffff;line-height:1.2;">Your first stream analysis is one click away.</h1>
          <p style="margin:0 0 28px;font-size:15px;color:rgba(255,255,255,0.55);line-height:1.6;">
            You signed up for LevlCast but haven't analyzed a stream yet. In about 5 minutes, you'll get a full coach report — score, peak moments, and exactly what to improve next stream.
          </p>

          <!-- CTA -->
          <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td style="background:#7C3AED;border-radius:12px;">
              <a href="https://levlcast.com/dashboard/vods" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">
                Analyze My First Stream →
              </a>
            </td></tr>
          </table>

          <!-- What you get -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:24px;">
            <tr>
              <td style="padding:8px 0;">
                <p style="margin:0;font-size:13px;font-weight:600;color:#ffffff;">Stream score</p>
                <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.4);">0–100 rating with specific strengths and improvements</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;">
                <p style="margin:0;font-size:13px;font-weight:600;color:#ffffff;">Clip moments</p>
                <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.4);">Your best hype, funny, and educational moments ready to clip</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;">
                <p style="margin:0;font-size:13px;font-weight:600;color:#ffffff;">Coach recommendation</p>
                <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.4);">One thing to focus on for your next stream</p>
              </td>
            </tr>
          </table>

        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:24px;text-align:center;">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">
            LevlCast · <a href="https://levlcast.com/dashboard/settings" style="color:rgba(255,255,255,0.2);text-decoration:underline;">Unsubscribe</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}
