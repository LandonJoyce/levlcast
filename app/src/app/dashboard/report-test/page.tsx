/**
 * Standalone visual preview of the new coach-report redesign. Lives at
 * /dashboard/report-test so we can iterate on the layout without touching
 * the live /dashboard/vods/[id]/report page or CoachReportCard.
 *
 * Ported from the user's "Gaming Coaching Report v2" HTML mock. Sample
 * data is hardcoded; once approved, this layout gets wired to real report
 * fields on the live page. Footer "GO LIVE / Let it ride" block from the
 * mock is intentionally omitted.
 */

const CSS = `
.rt-root{
  --bg-0:#06030c; --bg-1:#0c0618; --bg-2:#150b25;
  --line:rgba(255,255,255,0.08); --line-strong:rgba(255,255,255,0.14);
  --ink:#f5eefb; --ink-2:#c7b9d6; --muted:#7c6f8c; --muted-2:#4a4159;
  --magenta:#F26179; --magenta-soft:#FF9FB8; --cyan:#9B6AFF;
  --lime:#A3E635; --amber:#F59E0B; --red:#F87171; --plum:#9B6AFF;
  --pad-x:clamp(28px,4vw,80px);
}
.rt-root *{ box-sizing:border-box; }
.rt-root{
  font-family:var(--font-plus-jakarta), system-ui, sans-serif;
  background:var(--bg-0); color:var(--ink);
  -webkit-font-smoothing:antialiased; font-size:15px; line-height:1.55;
  min-height:100vh; position:relative; overflow-x:hidden;
}
.rt-root::before{
  content:""; position:fixed; inset:0; pointer-events:none; z-index:0;
  background:
    radial-gradient(900px 600px at 5% -10%, rgba(242,97,121,0.22), transparent 60%),
    radial-gradient(900px 700px at 105% 5%, rgba(140,60,255,0.18), transparent 60%),
    radial-gradient(900px 800px at 50% 110%, rgba(56,229,255,0.10), transparent 60%);
}
.rt-root::after{
  content:""; position:fixed; inset:0; pointer-events:none; z-index:1;
  background-image:
    linear-gradient(to bottom, rgba(255,255,255,0.022) 1px, transparent 1px),
    radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px);
  background-size:100% 3px, 3px 3px; mix-blend-mode:overlay;
}
.rt-wrap{ position:relative; z-index:2; max-width:1480px; margin:0 auto; padding:0 var(--pad-x) 96px; }

.rt-mono{ font-family:var(--font-geist-mono), ui-monospace, monospace; }
.rt-display{ font-family:var(--font-plus-jakarta), system-ui, sans-serif; }
.rt-serif-i{ font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-style:italic; font-weight:400; }
.rt-label{
  font-family:var(--font-geist-mono), monospace; font-size:10.5px;
  letter-spacing:0.22em; text-transform:uppercase; color:var(--muted);
}
.rt-timecode{
  font-family:var(--font-geist-mono), monospace; color:var(--magenta-soft);
  border-bottom:1px dotted rgba(255,122,184,0.5); padding-bottom:1px; white-space:nowrap;
}
.rt-pill{
  display:inline-flex; align-items:center; gap:6px;
  font-family:var(--font-geist-mono), monospace; font-size:10px;
  letter-spacing:0.18em; text-transform:uppercase;
  padding:3px 7px 2px; border-radius:2px; border:1px solid currentColor;
  color:var(--amber); background:rgba(245,158,11,0.07);
}

.rt-ticker{
  border-bottom:1px solid var(--line); height:36px; overflow:hidden;
  display:flex; align-items:center; font-family:var(--font-geist-mono), monospace;
  font-size:11px; letter-spacing:0.18em; text-transform:uppercase;
  color:var(--muted); white-space:nowrap; margin-bottom:20px;
}
.rt-ticker-strip{ display:flex; gap:36px; padding-left:0; animation:rtTickerScroll 38s linear infinite; }
.rt-ticker-strip span b{ color:var(--magenta); font-weight:500; }
.rt-ticker-strip span.green b{ color:var(--lime); }
.rt-ticker-strip span.red b{ color:var(--red); }
@keyframes rtTickerScroll{ from{ transform:translateX(0); } to{ transform:translateX(-50%); } }

.rt-topbar{ display:flex; align-items:center; justify-content:space-between; padding:4px 0 22px; margin-bottom:32px; }
.rt-brand{ display:flex; align-items:center; gap:12px; }
.rt-brand-mark{
  width:28px; height:28px; border:1.5px solid var(--magenta); border-radius:50%;
  position:relative; box-shadow:0 0 14px rgba(242,97,121,0.5);
}
.rt-brand-mark::after{
  content:""; position:absolute; inset:7px; background:var(--magenta);
  border-radius:50%; box-shadow:0 0 8px var(--magenta);
}
.rt-brand-name{ font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-size:19px; letter-spacing:0.18em; text-transform:uppercase; }
.rt-brand-name span{ color:var(--magenta); }
.rt-top-actions{ display:flex; align-items:center; gap:10px; }
.rt-btn{
  display:inline-flex; align-items:center; gap:8px; height:36px; padding:0 14px;
  font-family:var(--font-geist-mono), monospace; font-size:11px; letter-spacing:0.16em; text-transform:uppercase;
  border:1px solid var(--line-strong); background:rgba(255,255,255,0.02);
  color:var(--ink-2); border-radius:3px; cursor:pointer; transition:all .15s ease;
}
.rt-btn:hover{ color:var(--ink); border-color:rgba(255,255,255,0.24); background:rgba(255,255,255,0.04); }
.rt-btn.primary{ color:#14081e; background:var(--magenta); border-color:var(--magenta); box-shadow:0 0 22px rgba(242,97,121,0.4); }
.rt-btn.primary:hover{ background:var(--magenta-soft); border-color:var(--magenta-soft); }

.rt-cover{
  position:relative; border:1px solid var(--line-strong); border-radius:2px;
  overflow:hidden; margin-bottom:56px;
  background:
    radial-gradient(800px 400px at 80% 20%, rgba(242,97,121,0.18), transparent 70%),
    radial-gradient(900px 500px at 0% 100%, rgba(140,60,255,0.18), transparent 70%),
    linear-gradient(180deg, rgba(20,8,30,0.85), rgba(8,4,16,0.7));
}
.rt-cover-tape{
  height:28px; display:flex; align-items:center; gap:28px; padding:0 22px;
  background:var(--magenta); color:#14081e;
  font-family:var(--font-geist-mono), monospace; font-size:10.5px; font-weight:600;
  letter-spacing:0.24em; text-transform:uppercase; overflow:hidden;
}
.rt-cover-tape b{ color:#14081e; }
.rt-cover-body{ display:grid; grid-template-columns:1.05fr 0.95fr; align-items:stretch; min-height:540px; }
.rt-cover-left{
  padding:36px 40px 36px 44px; border-right:1px solid var(--line);
  display:flex; flex-direction:column; justify-content:space-between; position:relative;
}
.rt-cover-kicker{
  display:flex; gap:12px; align-items:center; margin-bottom:18px;
  font-family:var(--font-geist-mono), monospace; font-size:11px;
  letter-spacing:0.22em; text-transform:uppercase; color:var(--muted);
}
.rt-cover-kicker .chip{
  padding:3px 8px 2px; background:rgba(255,255,255,0.04);
  border:1px solid var(--line-strong); color:var(--ink-2); border-radius:2px;
}
.rt-cover-title{
  font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-size:clamp(72px,9vw,148px);
  font-weight:600; line-height:0.86; text-transform:uppercase;
  letter-spacing:-0.012em; margin:0; color:var(--ink);
}
.rt-cover-title em{
  font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-style:italic; font-weight:400;
  color:var(--magenta); text-transform:none; letter-spacing:-0.015em;
  text-shadow:0 0 28px rgba(242,97,121,0.35);
}
.rt-cover-title .smol{ display:block; font-size:0.55em; color:var(--ink-2); margin-top:4px; letter-spacing:0.02em; }
.rt-cover-summary{
  font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-size:clamp(20px,1.9vw,26px);
  line-height:1.35; color:var(--ink); max-width:50ch; margin:28px 0 0;
}
.rt-cover-summary em{ color:var(--magenta-soft); }
.rt-cover-summary .rt-timecode{ font-style:normal; font-family:var(--font-geist-mono), monospace; font-size:0.78em; }
.rt-cover-credits{
  margin-top:28px; display:grid; grid-template-columns:repeat(3,auto);
  gap:18px 32px; font-family:var(--font-geist-mono), monospace; font-size:11px;
  color:var(--muted); letter-spacing:0.14em; text-transform:uppercase;
  padding-top:22px; border-top:1px solid var(--line);
}
.rt-cover-credits b{ color:var(--ink); font-weight:500; display:block; margin-top:4px; letter-spacing:0.08em; }

.rt-cover-right{ position:relative; display:flex; flex-direction:column; overflow:hidden; }
.rt-cover-right::before{
  content:""; position:absolute; inset:0;
  background-image:
    linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
  background-size:40px 40px;
  mask-image:linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
  -webkit-mask-image:linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
}
.rt-scoreboard{ position:relative; padding:36px 40px 24px; flex:1; display:flex; flex-direction:column; justify-content:center; gap:8px; }
.rt-scoreboard .row{ display:flex; align-items:center; justify-content:space-between; padding:6px 0; }
.rt-scoreboard .row .rt-label{ font-size:11.5px; }
.rt-scoreboard .big{ display:flex; align-items:flex-end; gap:14px; margin:4px 0 14px; }
.rt-scoreboard .big .n{
  font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-size:clamp(160px,18vw,260px);
  line-height:0.82; color:var(--magenta);
  text-shadow:0 0 40px rgba(242,97,121,0.4); font-weight:600; letter-spacing:-0.02em;
}
.rt-scoreboard .big .d{ display:flex; flex-direction:column; gap:4px; padding-bottom:10px; }
.rt-scoreboard .big .d .of{ font-family:var(--font-geist-mono), monospace; font-size:14px; color:var(--muted); letter-spacing:0.2em; text-transform:uppercase; }
.rt-scoreboard .big .d .dlt{ display:inline-flex; gap:6px; align-items:center; font-family:var(--font-geist-mono), monospace; font-size:13px; color:var(--red); }
.rt-scoreboard .stat-row{ display:grid; grid-template-columns:repeat(4,1fr); gap:14px; padding-top:18px; border-top:1px solid var(--line); }
.rt-mini{ display:flex; flex-direction:column; gap:4px; }
.rt-mini .l{ font-family:var(--font-geist-mono), monospace; font-size:9.5px; letter-spacing:0.2em; color:var(--muted); text-transform:uppercase; }
.rt-mini .v{ font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-size:28px; line-height:1; color:var(--ink); }
.rt-mini .v small{ font-family:var(--font-geist-mono), monospace; font-size:11px; color:var(--muted-2); }
.rt-mini .b{ height:3px; background:rgba(255,255,255,0.06); position:relative; margin-top:4px; }
.rt-mini .b i{ position:absolute; left:0; top:0; bottom:0; }
.rt-mini.e .b i{ background:var(--magenta); width:48%; box-shadow:0 0 8px var(--magenta); }
.rt-mini.g .b i{ background:var(--cyan); width:32%; box-shadow:0 0 8px var(--cyan); }
.rt-mini.c .b i{ background:var(--red); width:40%; box-shadow:0 0 8px var(--red); }
.rt-mini.t .b i{ background:var(--lime); width:88%; box-shadow:0 0 8px var(--lime); }

.rt-versus{ display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:16px; padding:16px 40px 28px; border-top:1px dashed var(--line); }
.rt-vs-side{ display:flex; flex-direction:column; gap:4px; }
.rt-vs-side.right{ text-align:right; }
.rt-vs-side .who{ font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-size:22px; line-height:1; text-transform:uppercase; }
.rt-vs-side .who.you{ color:var(--lime); }
.rt-vs-side .who.them{ color:var(--magenta); }
.rt-vs-side .role{ font-family:var(--font-geist-mono), monospace; font-size:10px; letter-spacing:0.2em; color:var(--muted); text-transform:uppercase; }
.rt-vs-mid{ font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-style:italic; font-size:36px; color:var(--ink-2); line-height:1; }

.rt-obt-wrap{ display:grid; grid-template-columns:1fr 320px; gap:36px; margin-bottom:64px; align-items:stretch; }
.rt-obt{
  position:relative; padding:36px 36px 36px 110px;
  border:1px solid rgba(242,97,121,0.35);
  background:linear-gradient(90deg, rgba(242,97,121,0.10), rgba(242,97,121,0.01) 70%);
  border-radius:2px; overflow:hidden;
}
.rt-obt::before{
  content:"01"; position:absolute; left:28px; top:50%; transform:translateY(-50%);
  font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-size:78px; font-weight:500;
  color:var(--magenta); text-shadow:0 0 24px rgba(242,97,121,0.45); line-height:0.85;
}
.rt-obt .rt-label{ color:var(--magenta-soft); display:block; margin-bottom:10px; }
.rt-obt h2{ margin:0 0 14px; font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-size:32px; font-weight:500; text-transform:uppercase; letter-spacing:0.005em; }
.rt-obt h2 em{ font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-style:italic; font-weight:400; text-transform:none; color:var(--magenta); }
.rt-obt p{ margin:0; font-size:15.5px; line-height:1.55; color:var(--ink); max-width:84ch; }
.rt-obt p b{ color:var(--magenta-soft); font-weight:600; }
.rt-obt-stat{
  display:flex; flex-direction:column; gap:12px; padding:28px 28px;
  border:1px solid var(--line); background:rgba(255,255,255,0.02);
  border-radius:2px; justify-content:center;
}
.rt-obt-stat .item{ display:flex; align-items:baseline; gap:12px; }
.rt-obt-stat .item .n{ font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-size:48px; line-height:1; color:var(--ink); }
.rt-obt-stat .item .n.mag{ color:var(--magenta); text-shadow:0 0 16px rgba(242,97,121,0.35); }
.rt-obt-stat .item .n.lime{ color:var(--lime); }
.rt-obt-stat .item .l{ font-family:var(--font-geist-mono), monospace; font-size:10.5px; letter-spacing:0.18em; text-transform:uppercase; color:var(--muted); line-height:1.35; }
.rt-obt-stat .div{ height:1px; background:var(--line); }

.rt-section-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:16px; padding-bottom:14px; border-bottom:1px solid var(--line); margin-bottom:24px; }
.rt-section-head .l{ display:flex; align-items:baseline; gap:18px; }
.rt-section-head .l .ix{ font-family:var(--font-geist-mono), monospace; font-size:12px; color:var(--muted-2); letter-spacing:0.2em; }
.rt-section-head .title{ font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-size:clamp(40px,5vw,64px); font-weight:500; text-transform:uppercase; line-height:0.95; margin:0; letter-spacing:-0.005em; }
.rt-section-head .title em{ font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-style:italic; font-weight:400; text-transform:none; letter-spacing:-0.01em; }
.rt-section-head .sub{ color:var(--muted); font-family:var(--font-geist-mono), monospace; font-size:11px; letter-spacing:0.18em; text-transform:uppercase; text-align:right; max-width:22ch; }

.rt-build-fix{ display:grid; grid-template-columns:1fr 1fr; gap:0; margin-bottom:72px; border:1px solid var(--line); border-radius:2px; overflow:hidden; }
.rt-col{ display:flex; flex-direction:column; }
.rt-col.pos{ background:linear-gradient(180deg, rgba(163,230,53,0.04), transparent 60%); }
.rt-col.neg{ background:linear-gradient(180deg, rgba(248,113,113,0.05), transparent 60%); border-left:1px solid var(--line); }
.rt-col-head{ display:flex; align-items:center; justify-content:space-between; padding:22px 28px; border-bottom:1px solid var(--line); }
.rt-col-head h3{ margin:0; font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-size:28px; font-weight:500; text-transform:uppercase; letter-spacing:0.01em; }
.rt-col-head h3 em{ font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-style:italic; font-weight:400; text-transform:none; }
.rt-col.pos .rt-col-head h3 em{ color:var(--lime); }
.rt-col.neg .rt-col-head h3 em{ color:var(--red); }
.rt-col-head .tag{ font-family:var(--font-geist-mono), monospace; font-size:10px; letter-spacing:0.22em; text-transform:uppercase; padding:3px 8px 2px; border-radius:2px; }
.rt-col.pos .rt-col-head .tag{ background:var(--lime); color:#0c1604; }
.rt-col.neg .rt-col-head .tag{ background:var(--red); color:#160404; }

.rt-item{ display:grid; grid-template-columns:56px 1fr; gap:16px; padding:22px 28px; border-bottom:1px solid var(--line); }
.rt-item:last-of-type{ border-bottom:0; }
.rt-item .mark{ width:40px; height:40px; display:inline-flex; align-items:center; justify-content:center; border-radius:4px; font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-size:22px; font-weight:500; margin-top:2px; }
.rt-col.pos .mark{ color:var(--lime); border:1px solid rgba(163,230,53,0.5); background:rgba(163,230,53,0.08); }
.rt-col.neg .mark{ color:var(--red); border:1px solid rgba(248,113,113,0.45); background:rgba(248,113,113,0.06); }
.rt-item h4{ margin:0 0 8px; font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-size:26px; font-weight:500; letter-spacing:0.005em; text-transform:uppercase; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.rt-item h4 .rt-pill{ font-size:9.5px; padding:3px 6px 2px; }
.rt-item p{ margin:0; color:var(--ink-2); font-size:14.5px; line-height:1.55; max-width:56ch; }

.rt-outgoing{ padding:18px 28px 22px; background:rgba(245,158,11,0.06); border-top:1px solid rgba(245,158,11,0.25); border-bottom:1px solid rgba(245,158,11,0.18); }
.rt-outgoing .rt-label{ color:var(--amber); display:flex; align-items:center; gap:10px; margin-bottom:8px; }
.rt-outgoing .rt-label .idx{ width:18px; height:18px; display:inline-flex; align-items:center; justify-content:center; background:var(--amber); color:#1a0f04; font-size:10px; font-weight:700; border-radius:2px; letter-spacing:0; }
.rt-outgoing p{ margin:0; color:var(--ink-2); font-size:13.5px; line-height:1.5; max-width:60ch; }

.rt-callout{
  position:relative; padding:28px 32px 28px 100px;
  border:1px solid rgba(245,158,11,0.3);
  background:
    repeating-linear-gradient(135deg, rgba(245,158,11,0.10) 0 14px, rgba(245,158,11,0.02) 14px 28px),
    rgba(20,12,5,0.4);
  margin-bottom:72px; border-radius:2px;
}
.rt-callout::before{ content:"!"; position:absolute; left:28px; top:50%; transform:translateY(-50%); font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-size:52px; color:var(--amber); text-shadow:0 0 18px rgba(245,158,11,0.5); }
.rt-callout .rt-label{ color:var(--amber); margin-bottom:8px; display:block; }
.rt-callout h3{ margin:0 0 10px; font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-size:26px; font-weight:500; text-transform:uppercase; color:var(--amber); }
.rt-callout h3 em{ font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-style:italic; font-weight:400; text-transform:none; color:var(--ink); }
.rt-callout p{ margin:0; color:var(--ink); font-size:14.5px; line-height:1.6; max-width:96ch; }
.rt-callout p b{ color:var(--amber); font-weight:600; }
.rt-callout .streaks{ display:flex; gap:10px; margin-top:18px; padding-top:18px; border-top:1px dashed rgba(245,158,11,0.3); }
.rt-callout .streaks .s{ flex:1; padding:12px 14px; border:1px solid rgba(245,158,11,0.25); background:rgba(0,0,0,0.25); border-radius:2px; display:flex; flex-direction:column; gap:4px; }
.rt-callout .streaks .s .l{ font-family:var(--font-geist-mono), monospace; font-size:10px; color:var(--muted); letter-spacing:0.16em; text-transform:uppercase; }
.rt-callout .streaks .s .n{ font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-size:32px; color:var(--ink); line-height:1; }
.rt-callout .streaks .s.now{ background:rgba(245,158,11,0.14); }
.rt-callout .streaks .s.now .n{ color:var(--amber); }

.rt-trajectory{ border:1px solid var(--line); border-radius:2px; padding:28px 32px 32px; margin-bottom:56px; background:linear-gradient(180deg, rgba(255,255,255,0.022), transparent); }
.rt-traj-head{ display:flex; align-items:baseline; justify-content:space-between; margin-bottom:18px; }
.rt-traj-head h3{ margin:0; font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-size:30px; font-weight:500; text-transform:uppercase; }
.rt-traj-head h3 em{ font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-style:italic; font-weight:400; text-transform:none; color:var(--magenta); }
.rt-traj-head .meta{ display:flex; gap:18px; font-family:var(--font-geist-mono), monospace; font-size:11px; color:var(--muted); letter-spacing:0.18em; text-transform:uppercase; }
.rt-traj-head .meta span{ display:inline-flex; align-items:center; gap:6px; }
.rt-legend-dot{ display:inline-block; width:8px; height:8px; border-radius:50%; }

.rt-chart-wrap{ position:relative; padding-left:32px; }
.rt-y-axis{ position:absolute; left:0; top:0; bottom:32px; display:flex; flex-direction:column; justify-content:space-between; font-family:var(--font-geist-mono), monospace; font-size:10px; color:var(--muted-2); }
.rt-chart{ position:relative; height:260px; display:grid; grid-template-columns:repeat(8,1fr); align-items:end; gap:14px; border-bottom:1px solid var(--line); padding-bottom:4px; }
.rt-bar-col{ position:relative; display:flex; flex-direction:column; align-items:center; justify-content:end; height:100%; }
.rt-bar-col .bar{ width:100%; max-width:60px; background:linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.04)); border-top:2px solid rgba(255,255,255,0.22); position:relative; }
.rt-bar-col.current .bar{ background:linear-gradient(180deg, var(--magenta), rgba(242,97,121,0.4)); border-top:2px solid var(--magenta); box-shadow:0 0 18px rgba(242,97,121,0.5); }
.rt-bar-col .v{ position:absolute; top:-22px; font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-size:18px; color:var(--ink); }
.rt-bar-col.current .v{ color:var(--magenta); font-size:22px; }
.rt-x-labels{ display:grid; grid-template-columns:repeat(8,1fr); gap:14px; margin:10px 0 0; }
.rt-x-labels span{ text-align:center; font-family:var(--font-geist-mono), monospace; font-size:10px; color:var(--muted); letter-spacing:0.12em; text-transform:uppercase; }
.rt-x-labels span.now{ color:var(--magenta); }
.rt-avg-line{ position:absolute; left:0; right:0; height:1px; background:rgba(56,229,255,0.4); pointer-events:none; }
.rt-avg-line::after{ content:"AVG 18.6"; position:absolute; right:0; top:-16px; font-family:var(--font-geist-mono), monospace; font-size:9.5px; color:var(--cyan); letter-spacing:0.18em; padding:0 6px; background:var(--bg-0); }

.rt-timeline{ border:1px solid var(--line); border-radius:2px; padding:28px 32px 28px; margin-bottom:72px; background:linear-gradient(180deg, rgba(255,255,255,0.022), transparent); }
.rt-tl-head{ display:flex; align-items:baseline; justify-content:space-between; margin-bottom:18px; }
.rt-tl-head h3{ margin:0; font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-size:30px; font-weight:500; text-transform:uppercase; }
.rt-tl-head h3 em{ font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-style:italic; font-weight:400; text-transform:none; color:var(--magenta); }
.rt-tl-head .meta{ display:flex; gap:16px; font-family:var(--font-geist-mono), monospace; font-size:11px; color:var(--muted); letter-spacing:0.18em; text-transform:uppercase; }
.rt-tl-head .meta span{ display:inline-flex; align-items:center; gap:6px; }

.rt-tl-track{ position:relative; height:120px; border:1px solid var(--line); background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0)); border-radius:2px; overflow:hidden; }
.rt-tl-track svg{ width:100%; height:100%; display:block; }
.rt-tl-silent{ position:absolute; top:0; bottom:0; background:repeating-linear-gradient(135deg, rgba(245,158,11,0.20) 0 8px, rgba(245,158,11,0.04) 8px 16px); border-left:1px solid rgba(245,158,11,0.4); border-right:1px solid rgba(245,158,11,0.4); }
.rt-tl-silent .lbl{ position:absolute; top:8px; left:10px; font-family:var(--font-geist-mono), monospace; font-size:10px; color:var(--amber); letter-spacing:0.18em; text-transform:uppercase; }
.rt-tl-spike{ position:absolute; top:0; bottom:0; width:2px; background:var(--magenta); box-shadow:0 0 12px var(--magenta); }
.rt-tl-spike .lbl{ position:absolute; bottom:10px; left:8px; font-family:var(--font-geist-mono), monospace; font-size:10px; color:var(--magenta); letter-spacing:0.1em; white-space:nowrap; }
.rt-tl-moment{ position:absolute; top:0; bottom:0; width:2px; background:var(--lime); box-shadow:0 0 10px var(--lime); }
.rt-tl-moment .lbl{ position:absolute; top:8px; left:8px; font-family:var(--font-geist-mono), monospace; font-size:10px; color:var(--lime); letter-spacing:0.1em; white-space:nowrap; }
.rt-tl-end{ position:absolute; top:0; bottom:0; right:0; width:3px; background:var(--red); }
.rt-tl-end .lbl{ position:absolute; top:50%; right:12px; transform:translateY(-50%); font-family:var(--font-geist-mono), monospace; font-size:10px; color:var(--red); letter-spacing:0.2em; background:rgba(20,5,5,0.8); padding:4px 8px; border:1px solid var(--red); text-transform:uppercase; }
.rt-tl-axis{ display:flex; justify-content:space-between; margin-top:12px; font-family:var(--font-geist-mono), monospace; font-size:10px; color:var(--muted); letter-spacing:0.14em; }
.rt-tl-axis span.bold{ color:var(--ink); }
.rt-tl-stats{ display:grid; grid-template-columns:repeat(4,1fr); gap:0; margin-top:24px; padding-top:22px; border-top:1px solid var(--line); }
.rt-tl-stats .c{ padding:0 18px; border-right:1px solid var(--line); }
.rt-tl-stats .c:first-child{ padding-left:0; }
.rt-tl-stats .c:last-child{ border-right:0; padding-right:0; }
.rt-tl-stats .l{ font-family:var(--font-geist-mono), monospace; font-size:10px; letter-spacing:0.18em; color:var(--muted); text-transform:uppercase; }
.rt-tl-stats .v{ font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-size:30px; color:var(--ink); margin-top:6px; line-height:1; }
.rt-tl-stats .v.warn{ color:var(--amber); }
.rt-tl-stats .v.bad{ color:var(--red); }
.rt-tl-stats .h{ font-family:var(--font-geist-mono), monospace; font-size:10.5px; color:var(--muted-2); margin-top:4px; }

.rt-urgent-wrap{ margin-bottom:72px; }
.rt-urgent{
  display:grid; grid-template-columns:120px 1fr 280px; gap:0;
  border:1px solid rgba(163,230,53,0.32);
  background:linear-gradient(90deg, rgba(163,230,53,0.10), rgba(163,230,53,0.01) 50%);
  border-radius:2px; overflow:hidden;
}
.rt-urgent-mark{ background:rgba(163,230,53,0.10); border-right:1px solid rgba(163,230,53,0.22); display:flex; align-items:center; justify-content:center; flex-direction:column; padding:28px 8px; }
.rt-urgent-mark .n{ font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-size:84px; color:var(--lime); line-height:0.9; text-shadow:0 0 18px rgba(163,230,53,0.4); font-weight:600; }
.rt-urgent-mark .l{ margin-top:6px; font-family:var(--font-geist-mono), monospace; font-size:10px; letter-spacing:0.22em; color:var(--lime); text-transform:uppercase; }
.rt-urgent-body{ padding:26px 32px; }
.rt-urgent-body .top{ display:flex; align-items:center; gap:14px; margin-bottom:14px; flex-wrap:wrap; }
.rt-urgent-body .top .tag{ background:var(--lime); color:#0a1604; font-family:var(--font-geist-mono), monospace; font-size:10px; font-weight:700; letter-spacing:0.2em; text-transform:uppercase; padding:3px 8px 2px; border-radius:2px; }
.rt-urgent-body .top .time{ font-family:var(--font-geist-mono), monospace; font-size:13px; color:var(--lime); }
.rt-urgent-body h4{ font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-size:32px; font-weight:500; margin:0 0 14px; text-transform:uppercase; letter-spacing:0.005em; line-height:1; }
.rt-urgent-body h4 em{ font-family:var(--font-plus-jakarta), system-ui, sans-serif; font-style:italic; font-weight:400; text-transform:none; color:var(--lime); }
.rt-urgent-body p{ margin:0 0 12px; color:var(--ink-2); font-size:14.5px; line-height:1.6; max-width:70ch; }
.rt-urgent-body p:last-child{ margin-bottom:0; }
.rt-urgent-body p .rt-timecode{ color:var(--lime); border-bottom-color:rgba(163,230,53,0.4); }
.rt-urgent-body p b{ color:var(--lime); font-weight:600; }

.rt-urgent-arc{ padding:26px 24px; border-left:1px solid rgba(163,230,53,0.18); background:rgba(0,0,0,0.25); display:flex; flex-direction:column; gap:14px; }
.rt-urgent-arc .rt-label{ color:var(--lime); }
.rt-urgent-arc .arc{ position:relative; height:90px; border-bottom:1px solid rgba(163,230,53,0.2); }
.rt-urgent-arc .arc svg{ width:100%; height:100%; display:block; }
.rt-urgent-arc .pts{ display:flex; justify-content:space-between; font-family:var(--font-geist-mono), monospace; font-size:10px; color:var(--muted); letter-spacing:0.14em; text-transform:uppercase; }
.rt-urgent-arc .pts span.peak{ color:var(--lime); }
.rt-urgent-other{ display:flex; gap:8px; flex-wrap:wrap; margin-top:16px; padding-top:16px; border-top:1px dashed var(--line); }
.rt-urgent-other .chip{ display:inline-flex; gap:6px; align-items:center; font-family:var(--font-geist-mono), monospace; font-size:10.5px; letter-spacing:0.14em; color:var(--muted); text-transform:uppercase; padding:4px 8px; border:1px solid var(--line); border-radius:2px; background:rgba(255,255,255,0.02); }
.rt-urgent-other .chip b{ color:var(--ink-2); font-weight:500; }

.rt-foot{ display:grid; grid-template-columns:1fr; align-items:stretch; border-top:1px solid var(--line); padding-top:40px; gap:32px; }
.rt-foot-meta{ display:flex; flex-direction:column; gap:14px; }
.rt-foot-meta .row{ display:flex; justify-content:space-between; align-items:center; gap:12px; font-family:var(--font-geist-mono), monospace; font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:var(--muted); }
.rt-foot-meta .row b{ color:var(--ink); font-weight:500; }
.rt-foot-meta a{ color:var(--ink); text-decoration:none; border-bottom:1px solid var(--magenta); padding-bottom:2px; }
.rt-foot-meta a:hover{ color:var(--magenta-soft); }

@media (max-width:1100px){
  .rt-cover-body{ grid-template-columns:1fr; }
  .rt-cover-left{ border-right:0; border-bottom:1px solid var(--line); }
  .rt-obt-wrap{ grid-template-columns:1fr; }
  .rt-build-fix{ grid-template-columns:1fr; }
  .rt-col.neg{ border-left:0; border-top:1px solid var(--line); }
  .rt-urgent{ grid-template-columns:1fr; }
  .rt-urgent-mark{ flex-direction:row; gap:18px; padding:16px 22px; border-right:0; border-bottom:1px solid rgba(163,230,53,0.2); }
  .rt-urgent-arc{ border-left:0; border-top:1px solid rgba(163,230,53,0.18); }
}
@media (max-width:720px){
  .rt-topbar{ flex-direction:column; gap:16px; align-items:flex-start; }
  .rt-scoreboard .stat-row{ grid-template-columns:repeat(2,1fr); }
  .rt-callout{ padding-left:80px; }
  .rt-callout .streaks{ flex-direction:column; }
  .rt-tl-stats{ grid-template-columns:repeat(2,1fr); }
  .rt-tl-stats .c{ border-right:0; border-bottom:1px solid var(--line); padding:10px 0; }
}
`;

const TIMELINE_PATH =
  "M0,88 L20,55 L40,60 L60,68 L80,52 L100,46 L120,72 L140,82 L160,88 L180,92 L200,90 L220,94 L240,98 L260,96 L280,100 L300,98 L320,102 L340,100 L360,104 L380,102 L400,98 L420,96 L440,94 L460,98 L480,100 L500,98 L520,96 L540,98 L560,100 L580,98 L600,104 L620,102 L640,100 L660,96 L680,90 L700,82 L720,70 L740,60 L760,50 L780,38 L800,22 L820,30 L840,18 L860,8 L880,16 L900,4 L920,12 L940,28 L960,40 L980,60 L1000,80 L1000,120 L0,120 Z";

const ARC_PATH =
  "M0,80 L20,72 L40,60 L60,40 L80,20 L100,8 L120,12 L140,24 L160,42 L180,60 L200,72 L200,90 L0,90 Z";

export default function ReportTestPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="rt-root">
        <div className="rt-wrap">
          <section style={{ marginTop: 32 }}>
            <div className="rt-section-head">
              <div className="l">
                <span className="ix">§ 01</span>
                <h2 className="title">Build &amp; <em>Fix</em></h2>
              </div>
              <span className="sub">5 takeaways from Stream 06</span>
            </div>

            <div className="rt-build-fix">
              <div className="rt-col pos">
                <div className="rt-col-head">
                  <h3>What <em>Worked</em></h3>
                  <span className="tag">Build on these</span>
                </div>
                <div className="rt-item">
                  <span className="mark">✓</span>
                  <div>
                    <h4>Genuine Rage</h4>
                    <p>The compressed panic-to-resignation arc at <span className="rt-timecode">15:16</span> is the only real clip on the stream. Recreate it by narrating the build-up <em>before</em> the moment, not just reacting after.</p>
                  </div>
                </div>
                <div className="rt-item">
                  <span className="mark">✓</span>
                  <div>
                    <h4>Rivalry Frame</h4>
                    <p>Naming Lucky and framing it as a war in the first 30 seconds gave the stream an instant identity. Do this every match: name the opponent and state your read before a single second of gameplay.</p>
                  </div>
                </div>
                <div className="rt-outgoing">
                  <div className="rt-label"><span className="idx">1</span> Outgoing</div>
                  <p>The streamer established the matchup framing and rallied the team in the first minute, which gave the opening just enough shape before silence took over by minute three.</p>
                </div>
              </div>

              <div className="rt-col neg">
                <div className="rt-col-head">
                  <h3>What to <em>Fix</em></h3>
                  <span className="tag">Fix these next</span>
                </div>
                <div className="rt-item">
                  <span className="mark">✕</span>
                  <div>
                    <h4>Silent Grind <span className="rt-pill" style={{ color: "var(--amber)" }}>● Recurring</span></h4>
                    <p><span className="rt-timecode">12:00</span> to <span className="rt-timecode">12:55</span> is over ten minutes with eight words. Narrate the score, your positioning read, or what Lucky is doing every 30 seconds minimum.</p>
                  </div>
                </div>
                <div className="rt-item">
                  <span className="mark">✕</span>
                  <div>
                    <h4>No Take</h4>
                    <p>Nowhere in 16 minutes was there an opinion on Lucky&apos;s playstyle, the match state, or what was going wrong. One strong take mid-match gives chat something to react to.</p>
                  </div>
                </div>
                <div className="rt-item">
                  <span className="mark">✕</span>
                  <div>
                    <h4>Cold Ending <span className="rt-pill" style={{ color: "var(--amber)" }}>● Recurring</span></h4>
                    <p>Stream cut off at <span className="rt-timecode">16:20</span> on a frustrated line with zero closure. Call the final result, one sentence on the match, then sign-off, takes 20 seconds and makes the stream feel finished.</p>
                  </div>
                </div>
                <div className="rt-outgoing">
                  <div className="rt-label"><span className="idx">1</span> Outgoing</div>
                  <p>The stream ended mid-frustration at <span className="rt-timecode">16:20</span> with a blunt demand directed at a teammate, no sign-off, no recap, no acknowledgment of chat or the result.</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="rt-section-head">
              <div className="l">
                <span className="ix">§ 02</span>
                <h2 className="title">The <em>Trajectory</em></h2>
              </div>
              <span className="sub">Last 8 streams · score over time</span>
            </div>

            <div className="rt-trajectory">
              <div className="rt-traj-head">
                <h3>Plateau, not <em>plunge</em>.</h3>
                <div className="meta">
                  <span><span className="rt-legend-dot" style={{ background: "var(--magenta)", boxShadow: "0 0 8px var(--magenta)" }} />Score</span>
                  <span><span className="rt-legend-dot" style={{ background: "var(--cyan)" }} />Avg 18.6</span>
                </div>
              </div>

              <div className="rt-chart-wrap">
                <div className="rt-y-axis">
                  <span>40</span><span>30</span><span>20</span><span>10</span><span>0</span>
                </div>
                <div className="rt-chart">
                  <div className="rt-avg-line" style={{ bottom: "46%" }} />
                  {[
                    { v: 22, h: 55 },
                    { v: 18, h: 45 },
                    { v: 31, h: 78 },
                    { v: 8, h: 20 },
                    { v: 26, h: 65 },
                    { v: 18, h: 45 },
                    { v: 12, h: 30 },
                    { v: 14, h: 35, current: true },
                  ].map((b, i) => (
                    <div key={i} className={`rt-bar-col${b.current ? " current" : ""}`}>
                      <span className="v">{b.v}</span>
                      <div className="bar" style={{ height: `${b.h}%` }} />
                    </div>
                  ))}
                </div>
                <div className="rt-x-labels">
                  <span>Mar 14</span>
                  <span>Mar 21</span>
                  <span>Mar 28</span>
                  <span>Apr 04</span>
                  <span>Apr 11</span>
                  <span>Apr 18</span>
                  <span>May 02</span>
                  <span className="now">May 11 · Now</span>
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="rt-section-head">
              <div className="l">
                <span className="ix">§ 03</span>
                <h2 className="title">Stream <em>Timeline</em></h2>
              </div>
              <span className="sub">Talk activity · 0:00 → 16:20</span>
            </div>

            <div className="rt-timeline">
              <div className="rt-tl-head">
                <h3>16 minutes, <em>1 minute of talk</em>.</h3>
                <div className="meta">
                  <span><span className="rt-legend-dot" style={{ background: "var(--magenta)", boxShadow: "0 0 6px var(--magenta)" }} />Spike</span>
                  <span><span className="rt-legend-dot" style={{ background: "var(--amber)" }} />Silent</span>
                  <span><span className="rt-legend-dot" style={{ background: "var(--lime)" }} />Moment</span>
                </div>
              </div>

              <div className="rt-tl-track">
                <svg viewBox="0 0 1000 120" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="rt-wave" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="rgba(242,97,121,0.55)" />
                      <stop offset="100%" stopColor="rgba(242,97,121,0)" />
                    </linearGradient>
                  </defs>
                  <path d={TIMELINE_PATH} fill="url(#rt-wave)" stroke="#F26179" strokeWidth="1.4" />
                </svg>

                <div className="rt-tl-silent" style={{ left: "22%", width: "28%" }}>
                  <span className="lbl">Silent · 3:30 → 8:10</span>
                </div>
                <div className="rt-tl-silent" style={{ left: "73%", width: "6%" }}>
                  <span className="lbl">Silent · 12:00</span>
                </div>

                <div className="rt-tl-moment" style={{ left: "1.5%" }}>
                  <span className="lbl">◆ Rivalry · 0:25</span>
                </div>
                <div className="rt-tl-spike" style={{ left: "88%" }}>
                  <span className="lbl">↑ Frustration · 14:30</span>
                </div>
                <div className="rt-tl-spike" style={{ left: "93%" }}>
                  <span className="lbl">↑ Arc · 15:15</span>
                </div>

                <div className="rt-tl-end"><span className="lbl">CUT · 16:20</span></div>
              </div>

              <div className="rt-tl-axis">
                <span className="bold">0:00</span>
                <span>4:00</span>
                <span>8:00</span>
                <span>12:00</span>
                <span className="bold">16:20</span>
              </div>

              <div className="rt-tl-stats">
                <div className="c">
                  <div className="l">Talk time</div>
                  <div className="v">1m 04s</div>
                  <div className="h">6.5% of stream</div>
                </div>
                <div className="c">
                  <div className="l">Longest silence</div>
                  <div className="v warn">4m 40s</div>
                  <div className="h">3:30 → 8:10</div>
                </div>
                <div className="c">
                  <div className="l">Spikes</div>
                  <div className="v">2</div>
                  <div className="h">Both inside last 90s</div>
                </div>
                <div className="c">
                  <div className="l">Sign-off</div>
                  <div className="v bad">none</div>
                  <div className="h">Cut mid-frustration</div>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </>
  );
}
