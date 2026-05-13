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
    ? "One report is a snapshot. The change between streams is where coaching actually lives. Your last report set the baseline, this one shows what moved."
    : "5 minutes to a full coach report: score, peak moments, and exactly what to change next stream.";

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
    subject: scoreText ? `Your stream scored ${scoreText}: report ready` : "Your stream report is ready",
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
    from: "Landon @ LevlCast <hello@levlcast.com>",
    to,
    replyTo: "support@levlcast.com",
    subject: "Hey, welcome to LevlCast",
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

          <p style="margin:0 0 20px;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;">Hey ${name},</p>

          <p style="margin:0 0 18px;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;">
            I'm Landon, the founder of LevlCast. I just wanted to personally say: thank you for signing up and giving this a shot. It genuinely means a lot.
          </p>

          <p style="margin:0 0 18px;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;">
            I built LevlCast because I wanted a tool that actually helps streamers grow. Not just giving them vague numbers, but tells them what to fix and shows them their best moments. Every person who joins is part of a community of streamers who are serious about improving together, and I'm glad you're one of them.
          </p>

          <p style="margin:0 0 18px;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;">
            To get started, sync your streams and run your first analysis. It takes about 5 minutes and you'll get a full coach report with your stream score, clip moments, and one specific thing to focus on next time.
          </p>

          <p style="margin:0 0 28px;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;">
            If you run into anything or have questions, reach us at support@levlcast.com.
          </p>

          <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr><td style="background:#7C3AED;border-radius:12px;">
              <a href="https://levlcast.com/dashboard/vods" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">
                Analyze My First Stream →
              </a>
            </td></tr>
          </table>

          <p style="margin:0 0 6px;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;">Talk soon,</p>
          <p style="margin:0;font-size:15px;font-weight:700;color:#ffffff;">Landon</p>
          <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.35);">Founder, LevlCast</p>

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

export async function sendProWelcomeEmail(to: string, name: string): Promise<void> {
  await resend.emails.send({
    from: "Landon @ LevlCast <hello@levlcast.com>",
    to,
    replyTo: "support@levlcast.com",
    subject: "You're now on Pro",
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welcome to Pro</title></head>
<body style="margin:0;padding:0;background:#0A0A0F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0F;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <tr><td style="padding-bottom:32px;">
          <span style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">LevlCast</span>
        </td></tr>

        <tr><td style="background:#141418;border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:40px 36px;">

          <p style="margin:0 0 20px;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;">Hey ${name},</p>

          <p style="margin:0 0 18px;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;">
            You're officially a Pro member. Seriously, thank you. Every person who goes Pro is what keeps LevlCast getting better, and I don't take that lightly.
          </p>

          <p style="margin:0 0 24px;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;">
            Here's what's unlocked for you now:
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a22;border-radius:14px;padding:20px 24px;margin-bottom:28px;">
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                <p style="margin:0;font-size:14px;font-weight:600;color:#a78bfa;">20 stream analyses / month</p>
                <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.4);">Run a report after every stream, track your score over time</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                <p style="margin:0;font-size:14px;font-weight:600;color:#a78bfa;">20 clips / month</p>
                <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.4);">Auto-generated from your best moments, ready to post</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                <p style="margin:0;font-size:14px;font-weight:600;color:#a78bfa;">Full coaching breakdown</p>
                <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.4);">Strengths, improvements, energy trend, and your streamer archetype</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;">
                <p style="margin:0;font-size:14px;font-weight:600;color:#a78bfa;">Post directly to YouTube</p>
                <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.4);">Connect your channel and publish clips without leaving LevlCast</p>
              </td>
            </tr>
          </table>

          <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr><td style="background:#7C3AED;border-radius:12px;">
              <a href="https://levlcast.com/dashboard/vods" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">
                Go to Dashboard →
              </a>
            </td></tr>
          </table>

          <p style="margin:0 0 18px;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;">
            If you ever have questions, run into anything weird, or just want to share feedback, email us at support@levlcast.com. I read every one.
          </p>

          <p style="margin:0 0 6px;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.7;">Talk soon,</p>
          <p style="margin:0;font-size:15px;font-weight:700;color:#ffffff;">Landon</p>
          <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.35);">Founder, LevlCast</p>

        </td></tr>

        <tr><td style="padding-top:24px;text-align:center;">
          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">
            LevlCast · <a href="https://levlcast.com/dashboard/settings" style="color:rgba(255,255,255,0.2);text-decoration:underline;">Manage subscription</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendClipReadyEmail(
  to: string,
  name: string,
  vodId: string,
  clipTitle: string,
  score: number | undefined
): Promise<void> {
  const scoreText = score !== undefined ? `${score}/100` : null;
  const vodUrl = `https://levlcast.com/dashboard/vods/${vodId}`;
  const upgradeUrl = `https://levlcast.com/dashboard/settings`;

  await resend.emails.send({
    from: "LevlCast <hello@levlcast.com>",
    to,
    subject: "Your clip is ready to post",
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your clip is ready</title></head>
<body style="margin:0;padding:0;background:#0A0A0F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0F;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <tr><td style="padding-bottom:32px;">
          <span style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">LevlCast</span>
        </td></tr>

        <tr><td style="background:#141418;border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:40px 36px;">

          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#a78bfa;">Hey ${name}</p>
          <h1 style="margin:0 0 14px;font-size:26px;font-weight:800;color:#ffffff;line-height:1.2;">Your clip is ready to post.</h1>
          <p style="margin:0 0 24px;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.6;">Your coach found your best moment from this stream and cut it automatically.</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a22;border-radius:14px;padding:16px 20px;margin-bottom:26px;">
            <tr><td>
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.3);">Best moment${scoreText ? ` · Stream scored ${scoreText}` : ""}</p>
              <p style="margin:0;font-size:15px;font-weight:600;color:#ffffff;line-height:1.4;">${clipTitle}</p>
            </td></tr>
          </table>

          <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            <tr><td style="background:#7C3AED;border-radius:12px;">
              <a href="${vodUrl}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">
                View and Download Clip →
              </a>
            </td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:24px;margin-bottom:24px;">
            <tr><td>
              <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#ffffff;">You've used your free clip for this month.</p>
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6;">Pro gives you 20 clips and 20 stream analyses every month so you can post consistently and track how your streams improve over time.</p>
            </td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a22;border-radius:14px;padding:16px 20px;margin-bottom:26px;">
            <tr>
              <td style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.8);">20 clips / month</p>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.8);">20 stream analyses / month</p>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.8);">Score history and improvement tracking</p>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;">
                <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.8);">Post clips directly to YouTube</p>
              </td>
            </tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a22;border-radius:14px;padding:16px 20px;margin-bottom:26px;">
            <tr><td>
              <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.55);line-height:1.6;font-style:italic;">"LevlCast is incredible. The clips it finds are exactly the moments my viewers react to most."</p>
              <p style="margin:0;font-size:12px;font-weight:700;color:rgba(255,255,255,0.35);">Charmbix, Twitch streamer</p>
            </td></tr>
          </table>

          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.4);border-radius:12px;">
              <a href="${upgradeUrl}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#a78bfa;text-decoration:none;">
                Upgrade to Pro — $9.99/mo →
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
            You signed up for LevlCast but haven't analyzed a stream yet. In about 5 minutes, you'll get a full coach report: score, peak moments, and exactly what to improve next stream.
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

/**
 * Notify the admin (landonjoyce@hotmail.com) whenever a user submits
 * feedback. Body is escaped + truncated server-side so a malicious payload
 * cannot inject HTML into the email.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendFeedbackToAdmin(input: {
  category: string;
  message: string;
  fromEmail: string | null;
  twitchLogin: string | null;
  userId: string | null;
  context: Record<string, unknown> | null;
}): Promise<void> {
  const safeMessage = escapeHtml(input.message).replace(/\n/g, "<br>");
  const safeCategory = escapeHtml(input.category);
  const safeFromEmail = escapeHtml(input.fromEmail ?? "(no email on file)");
  const safeTwitch = escapeHtml(input.twitchLogin ?? "(no twitch login)");
  const safeUserId = escapeHtml(input.userId ?? "(no user id)");
  const contextJson = input.context ? escapeHtml(JSON.stringify(input.context, null, 2)) : null;

  await resend.emails.send({
    from: "LevlCast Feedback <hello@levlcast.com>",
    to: "landonjoyce@hotmail.com",
    subject: `[LevlCast feedback · ${input.category}] ${input.fromEmail ?? "anon"}`,
    html: `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#0A0A0F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff;">
  <div style="max-width:560px;margin:0 auto;background:#141418;border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:28px;">
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#22D3EE;">LevlCast Feedback</p>
    <h1 style="margin:0 0 16px;font-size:20px;font-weight:800;">Category: ${safeCategory}</h1>
    <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.5);">From: ${safeFromEmail}</p>
    <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.5);">Twitch: ${safeTwitch}</p>
    <p style="margin:0 0 18px;font-size:12px;color:rgba(255,255,255,0.5);">User ID: ${safeUserId}</p>
    <div style="background:#0A0A0F;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.9);">${safeMessage}</div>
    ${contextJson ? `<details style="margin-top:16px;"><summary style="cursor:pointer;font-size:12px;color:rgba(255,255,255,0.5);">Context</summary><pre style="margin:8px 0 0;padding:12px;background:#0A0A0F;border-radius:8px;font-size:11px;color:rgba(255,255,255,0.65);white-space:pre-wrap;word-break:break-word;">${contextJson}</pre></details>` : ""}
    <p style="margin:20px 0 0;font-size:11px;color:rgba(255,255,255,0.3);">View all feedback at <a href="https://levlcast.com/dashboard/admin/feedback" style="color:#22D3EE;">/dashboard/admin/feedback</a></p>
  </div>
</body></html>`,
  });
}
