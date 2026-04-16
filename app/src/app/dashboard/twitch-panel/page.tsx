import { createClient } from "@/lib/supabase/server";
import { ExternalLink, Download, Twitch } from "lucide-react";
import { PanelLinkCopy } from "./panel-client";

/**
 * /dashboard/twitch-panel — install a "Coached by LevlCast" panel under
 * your Twitch channel. Gives Pro users passive social proof on their own
 * channel and gives LevlCast free backlinks from real streamers.
 */
export default async function TwitchPanelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("twitch_login")
    .eq("id", user!.id)
    .single();

  const login = profile?.twitch_login || "";

  // Personalized referral link. Uses twitch login as the ref tag so we can
  // attribute signups later if we add tracking.
  const referralLink = login
    ? `https://levlcast.com/?ref=${encodeURIComponent(login)}`
    : "https://levlcast.com/";

  // Panel image URL — intentionally generic so the viewer-facing CTA
  // nudges visitors toward LevlCast, not toward the streamer.
  const panelImageUrl = `/api/twitch-panel`;

  return (
    <div className="max-w-[820px]">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 text-accent-light text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3">
          <Twitch size={12} /> New
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">
          Show off your Coach
        </h1>
        <p className="text-sm text-muted max-w-[580px]">
          Add a &ldquo;Coached by LevlCast&rdquo; panel under your Twitch stream.
          Your viewers see you take growth seriously — and it takes less than a minute
          to install.
        </p>
      </div>

      {/* Panel preview */}
      <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
        <div className="text-[11px] font-medium text-muted/60 uppercase tracking-wider mb-3">
          Preview
        </div>
        <div
          className="rounded-xl overflow-hidden border border-white/[0.06]"
          style={{ maxWidth: 480 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={panelImageUrl}
            alt="Coached by LevlCast panel"
            width={480}
            height={150}
            style={{ display: "block", width: "100%", height: "auto" }}
          />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={panelImageUrl}
            download="coached-by-levlcast.png"
            className="inline-flex items-center gap-2 bg-accent text-white font-semibold text-sm px-4 py-2.5 rounded-full hover:shadow-[0_0_30px_rgba(124,58,237,0.4)] transition-all"
          >
            <Download size={15} />
            Download panel image
          </a>
          <a
            href="https://dashboard.twitch.tv/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-white/10 text-white/80 hover:text-white hover:border-accent/40 font-semibold text-sm px-4 py-2.5 rounded-full transition-all"
          >
            <ExternalLink size={15} />
            Open Twitch dashboard
          </a>
        </div>
      </div>

      {/* Your link */}
      <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
        <div className="text-[11px] font-medium text-muted/60 uppercase tracking-wider mb-2">
          Your panel link
        </div>
        <p className="text-sm text-muted mb-4">
          Paste this into the panel&apos;s link field on Twitch. It sends your
          viewers to LevlCast so they can try it too.
        </p>
        <PanelLinkCopy link={referralLink} />
      </div>

      {/* Install instructions */}
      <div className="bg-surface border border-border rounded-2xl p-6">
        <div className="text-[11px] font-medium text-muted/60 uppercase tracking-wider mb-4">
          Install in 30 seconds
        </div>
        <ol className="space-y-4">
          {[
            {
              title: "Download the panel image",
              body: "Click the Download button above. The image is already sized for Twitch (320×100).",
            },
            {
              title: "Open your Twitch channel",
              body: "Go to twitch.tv/" + (login || "your-channel") +
                " and click Edit Panels (the toggle below your stream, only visible to you).",
            },
            {
              title: "Add a new panel",
              body: "Click the + tile under your About section, then choose Add a Text or Image Panel.",
            },
            {
              title: "Upload the image and paste the link",
              body: "Upload coached-by-levlcast.png as the image, paste your panel link above into the Image Links To field, and save.",
            },
          ].map((step, i) => (
            <li key={i} className="flex gap-4">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-xs font-bold text-accent-light">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white mb-1">{step.title}</div>
                <div className="text-sm text-muted leading-relaxed">{step.body}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
