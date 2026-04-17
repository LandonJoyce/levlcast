import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
