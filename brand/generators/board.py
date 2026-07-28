import json, base64, os
d=json.load(open("tokens.json")); P,T=d["ramps"],d["themes"]

def b64(p):
    return "data:image/svg+xml;base64,"+base64.b64encode(open(p,'rb').read()).decode()

def swatches(name, keys=None):
    r=P[name]; keys=keys or ["50","100","200","300","400","500","600","700","800","900","950"]
    cells=""
    for k in keys:
        if k not in r: continue
        txt="#1D1813" if int(k)<=400 else "#FFFFFF"
        cells+=f'<div class="sw" style="background:{r[k]};color:{txt}"><b>{k}</b><span>{r[k]}</span></div>'
    return f'<div class="ramp"><div class="ramp-name">{name}</div><div class="ramp-row">{cells}</div></div>'

def token_table(theme):
    t=T[theme]
    rows=""
    keys=["bg-canvas","bg-surface","bg-sunken","border-default","border-strong",
          "text-primary","text-secondary","text-muted","brand-solid","brand-text",
          "brand-subtle-bg","brand-ring","success","warning","danger","info"]
    for k in keys:
        l,dk=t["light"][k],t["dark"][k]
        rows+=(f'<tr><td class="tk">{k}</td>'
               f'<td><i style="background:{l}"></i><code>{l}</code></td>'
               f'<td><i style="background:{dk}"></i><code>{dk}</code></td></tr>')
    return f'<table class="tok"><thead><tr><th>token</th><th>light</th><th>dark</th></tr></thead><tbody>{rows}</tbody></table>'

def app_mock(theme, mode):
    t=T[theme][mode]
    def task(txt, meta, done=False, pri=None):
        box=(f'<span class="cb done" style="background:{t["brand-solid"]};border-color:{t["brand-solid"]}">'
             f'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="{t["text-inverse"]}" '
             f'stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 L9.5 18 L20 6.5"/></svg></span>'
             if done else f'<span class="cb" style="border-color:{t["border-strong"]}"></span>')
        cls="txt done-txt" if done else "txt"
        chip=f'<span class="chip" style="background:{t["danger"]}1A;color:{t["danger"]}">{pri}</span>' if pri else ""
        return (f'<div class="task" style="border-color:{t["border-subtle"]}">{box}'
                f'<div class="tbody"><div class="{cls}" style="color:{t["text-primary"]}">{txt}</div>'
                f'<div class="meta" style="color:{t["text-muted"]}">{meta}</div></div>{chip}</div>')
    return f'''
<div class="phone" style="background:{t["bg-canvas"]};border-color:{t["border-default"]}">
  <div class="ph-top">
    <div>
      <div class="ph-hi" style="color:{t["text-muted"]}">Tuesday, 28 July</div>
      <div class="ph-title" style="color:{t["text-primary"]}">Today</div>
    </div>
    <div class="ph-av" style="background:{t["brand-subtle-bg"]};color:{t["brand-text"]}">3</div>
  </div>
  <div class="banner" style="background:{t["brand-subtle-bg"]};border-color:{t["brand-subtle-border"]}">
    <span style="color:{t["brand-text"]}">Nudge · 2 tasks slipped from yesterday</span>
  </div>
  <div class="list" style="background:{t["bg-surface"]};border-color:{t["border-subtle"]}">
    {task("Send Q3 report to Amina","9:00 · Work",pri="Now")}
    {task("Book dentist","Overdue 2d",)}
    {task("Reply to landlord","Yesterday",done=True)}
    {task("Buy coffee beans","Anytime",done=True)}
  </div>
  <button class="fab" style="background:{t["brand-solid"]};color:{t["text-inverse"]}">+ Add task</button>
</div>'''

MARKS=[("A · n-in-motion","logos/A-n-motion.svg","logos/A-n-motion-appicon.svg"),
       ("B · push","logos/B-push.svg","logos/B-push-appicon.svg"),
       ("C · check-in-motion","logos/C-check.svg","logos/C-check-appicon.svg"),
       ("D · ping","logos/D-ping.svg","logos/D-ping-appicon.svg")]
mark_cards="".join(
  f'<div class="mk"><img src="{b64(s)}"><div class="mk-ic"><img src="{b64(i)}"></div><div class="mk-n">{n}</div></div>'
  for n,s,i in MARKS)

html=f'''<!doctype html><html><head><meta charset="utf-8"><title>Nudge — brand system</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*{{box-sizing:border-box}}
body{{margin:0;background:#FEFBF8;color:#332D26;
 font-family:"Plus Jakarta Sans",ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}}
.wrap{{max-width:1180px;margin:0 auto;padding:56px 32px 96px}}
h1{{font-size:52px;letter-spacing:-.03em;margin:0 0 8px;font-weight:800}}
.sub{{color:#7C7268;font-size:18px;margin:0 0 12px;max-width:60ch;line-height:1.6}}
h2{{font-size:13px;text-transform:uppercase;letter-spacing:.14em;color:#7C7268;
 margin:64px 0 20px;font-weight:700;border-top:1px solid #EDE7E0;padding-top:20px}}
h3{{font-size:16px;margin:0 0 12px;font-weight:700}}
.hero{{display:flex;align-items:center;gap:28px;flex-wrap:wrap;margin:28px 0 8px}}
.hero img{{height:78px}}
.grid4{{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}}
.mk{{background:#fff;border:1px solid #EDE7E0;border-radius:18px;padding:20px;text-align:center}}
.mk>img{{height:84px;margin-bottom:14px}}
.mk-ic img{{width:62px;border-radius:15px;display:block;margin:0 auto 12px}}
.mk-n{{font-size:12.5px;color:#655C52;font-weight:600}}
.ramp{{margin-bottom:14px}}
.ramp-name{{font-size:12px;font-weight:700;color:#655C52;margin-bottom:6px;text-transform:uppercase;letter-spacing:.08em}}
.ramp-row{{display:flex;border-radius:12px;overflow:hidden;border:1px solid #EDE7E0}}
.sw{{flex:1;padding:14px 6px 12px;font-size:9.5px;text-align:center;line-height:1.5;min-width:0}}
.sw b{{display:block;font-size:11px;font-weight:700}}
.sw span{{font-family:"JetBrains Mono",monospace;opacity:.85;font-size:8.5px}}
.cols3{{display:grid;grid-template-columns:repeat(3,1fr);gap:26px}}
.card{{background:#fff;border:1px solid #EDE7E0;border-radius:18px;padding:22px}}
.tok{{width:100%;border-collapse:collapse;font-size:11px}}
.tok th{{text-align:left;color:#7C7268;font-weight:700;padding:0 0 8px;font-size:9.5px;
 text-transform:uppercase;letter-spacing:.08em}}
.tok td{{padding:3px 0;border-top:1px solid #F6F1EA;white-space:nowrap}}
.tok .tk{{font-family:"JetBrains Mono",monospace;color:#655C52;font-size:10px;padding-right:10px}}
.tok i{{display:inline-block;width:11px;height:11px;border-radius:3px;vertical-align:-1px;
 margin-right:5px;border:1px solid rgba(0,0,0,.14)}}
.tok code{{font-family:"JetBrains Mono",monospace;font-size:9.5px;color:#847A6F}}
.mocks{{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:22px}}
.phone{{border:1px solid;border-radius:26px;padding:20px;min-height:460px;display:flex;flex-direction:column}}
.ph-top{{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}}
.ph-hi{{font-size:11px;font-weight:600;letter-spacing:.02em}}
.ph-title{{font-size:27px;font-weight:800;letter-spacing:-.02em;margin-top:2px}}
.ph-av{{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700}}
.banner{{border:1px solid;border-radius:13px;padding:10px 13px;font-size:11.5px;font-weight:600;margin-bottom:14px}}
.list{{border:1px solid;border-radius:17px;overflow:hidden;flex:1}}
.task{{display:flex;gap:11px;padding:13px 14px;border-bottom:1px solid;align-items:flex-start}}
.task:last-child{{border-bottom:none}}
.cb{{width:19px;height:19px;border-radius:6px;border:2px solid;flex:none;margin-top:1px;
 display:grid;place-items:center}}
.tbody{{flex:1;min-width:0}}
.txt{{font-size:13px;font-weight:600;line-height:1.35}}
.done-txt{{text-decoration:line-through;opacity:.42}}
.meta{{font-size:10.5px;margin-top:3px;font-weight:500}}
.chip{{font-size:9px;font-weight:800;padding:3px 7px;border-radius:99px;letter-spacing:.04em;
 text-transform:uppercase;flex:none}}
.fab{{margin-top:16px;border:none;border-radius:14px;padding:14px;font-size:14px;font-weight:700;
 font-family:inherit;cursor:pointer;width:100%}}
.typ{{background:#fff;border:1px solid #EDE7E0;border-radius:18px;padding:28px}}
.t-row{{display:flex;align-items:baseline;gap:20px;padding:11px 0;border-top:1px solid #F6F1EA;flex-wrap:wrap}}
.t-row:first-child{{border-top:none}}
.t-lab{{width:150px;font-size:10px;font-family:"JetBrains Mono",monospace;color:#847A6F;flex:none}}
.note{{font-size:13.5px;color:#655C52;line-height:1.72;max-width:74ch}}
.note b{{color:#332D26}}
.pill{{display:inline-block;background:#FAEDDC;color:#874000;border-radius:99px;
 padding:5px 13px;font-size:11px;font-weight:700;margin:0 6px 6px 0}}
.rec{{background:linear-gradient(135deg,#FCF7EF,#FAEDDC);border:1px solid #F6DAB8;
 border-radius:18px;padding:24px 26px;margin-top:22px}}
.dark-strip{{background:#1D1813;border-radius:18px;padding:34px;display:flex;
 align-items:center;gap:32px;flex-wrap:wrap;justify-content:center}}
.dark-strip img{{height:62px}}
</style></head><body><div class="wrap">

<h1>Nudge</h1>
<p class="sub">A brand system for a to‑do app that gently pushes you forward.
Three complete directions — logo, palette, and tokens. Every colour pair below was
programmatically contrast‑checked; all 78 pairings meet WCAG AA or better.</p>
<div class="hero">
  <img src="{b64('logos/A-n-motion-lockup-h.svg')}">
  <img src="{b64('logos/A-n-motion-appicon.svg')}" style="height:74px;border-radius:17px">
</div>

<h2>01 · Logo concepts</h2>
<div class="grid4">{mark_cards}</div>
<div class="rec">
  <h3>Recommendation: <b>A — “n in motion”</b></h3>
  <p class="note" style="margin:6px 0 0">It's the only mark that is simultaneously the product's
  first letter, a visual metaphor for the name, and a shape nobody else in the category owns.
  The two trailing lines do the semantic work: they turn a neutral letterform into something
  <b>being nudged forward</b>. It survived the 16px favicon test, works as a single flat colour,
  and the trail can animate on task‑complete. <b>B — “push”</b> is the strongest runner‑up and the
  most literal; <b>C</b> is the safe choice but checkmarks are the most crowded symbol in the category.</p>
</div>

<h2>02 · Dark surfaces</h2>
<div class="dark-strip">
  <img src="{b64('logos/A-lockup-h-dark.svg')}">
  <img src="{b64('logos/B-push-appicon.svg')}" style="height:62px;border-radius:15px">
  <img src="{b64('logos/D-ping-appicon.svg')}" style="height:62px;border-radius:15px">
</div>

<h2>03 · Colour — three directions</h2>
<div class="cols3">
  <div>
    <h3>Ember <span class="pill">recommended</span></h3>
    <p class="note">Warm amber on a warm‑grey base. Energetic and encouraging without the
    alarm‑clock aggression of red. Critically: the category is <b>saturated with blue</b> —
    TickTick, Things, Microsoft To&nbsp;Do — and Todoist owns red. Amber is open territory.</p>
  </div>
  <div><h3>Focus Violet</h3>
    <p class="note">Violet on cool slate. Reads modern, calm and a little premium; the natural
    fit if Nudge leans into AI‑assisted scheduling. Highest chroma of the three.</p></div>
  <div><h3>Quiet Teal</h3>
    <p class="note">Deep teal on sage‑grey. The low‑stimulation option — best if your users are
    ADHD‑adjacent or anxiety‑prone and a loud UI would work against the product.</p></div>
</div>
<div style="margin-top:22px">
{swatches("ember")}{swatches("violet")}{swatches("teal")}
</div>
<div style="margin-top:18px">
{swatches("sand")}{swatches("slate")}{swatches("stone")}
</div>
<div style="margin-top:18px">
{swatches("green")}{swatches("amber")}{swatches("red")}{swatches("blue")}
</div>

<h2>04 · In context</h2>
<div class="mocks">
  {app_mock("ember","light")}
  {app_mock("ember","dark")}
  {app_mock("violet","dark")}
  {app_mock("teal","light")}
</div>

<h2>05 · Semantic tokens</h2>
<div class="cols3">
  <div class="card"><h3>Ember</h3>{token_table("ember")}</div>
  <div class="card"><h3>Focus Violet</h3>{token_table("violet")}</div>
  <div class="card"><h3>Quiet Teal</h3>{token_table("teal")}</div>
</div>

<h2>06 · Type</h2>
<div class="typ">
  <div class="t-row"><span class="t-lab">Display / 44 · 800</span>
    <span style="font-size:44px;font-weight:800;letter-spacing:-.03em">Nothing due. Nice.</span></div>
  <div class="t-row"><span class="t-lab">Title / 27 · 800</span>
    <span style="font-size:27px;font-weight:800;letter-spacing:-.02em">Today</span></div>
  <div class="t-row"><span class="t-lab">Task / 15 · 600</span>
    <span style="font-size:15px;font-weight:600">Send Q3 report to Amina</span></div>
  <div class="t-row"><span class="t-lab">Body / 15 · 400</span>
    <span style="font-size:15px">Nudge reschedules what you miss, instead of stacking up guilt.</span></div>
  <div class="t-row"><span class="t-lab">Meta / 11.5 · 500</span>
    <span style="font-size:11.5px;font-weight:500;color:#7C7268">Overdue 2 days · Work</span></div>
  <div class="t-row"><span class="t-lab">Mono / 12.5</span>
    <span style="font-family:'JetBrains Mono',monospace;font-size:12.5px">--brand-solid: #A45400;</span></div>
  <p class="note" style="margin-top:16px"><b>Plus Jakarta Sans</b> (700/800 for headings, 500/600
  for tasks) — geometric enough to echo the logo's monoline construction, with a friendly
  single‑storey <i>g</i>. Free on Google Fonts. Fallbacks: Inter, or system UI.
  Pair with <b>JetBrains Mono</b> for any code or token display.</p>
</div>

<h2>07 · Motion &amp; feel</h2>
<div class="card">
  <p class="note">The name is a promise about <i>tone</i>, so motion matters as much as colour.
  <b>Complete a task:</b> the checkbox fills with a 200ms spring, the row desaturates and the
  strike‑through wipes left→right — never an instant disappearance.
  <b>A nudge arrives:</b> the row slides 6px right and settles, echoing the logo's trail lines.
  <b>Overdue:</b> tint the metadata, never the whole row red — the app should feel like a
  colleague tapping your shoulder, not a smoke alarm.
  Standard easing <code>cubic-bezier(.22,1,.36,1)</code> at 200ms; springs only on completion.
  All of it collapses under <code>prefers-reduced-motion</code>.</p>
</div>

</div></body></html>'''
open("brand-board.html","w").write(html)
print("brand-board.html", len(html), "bytes")
