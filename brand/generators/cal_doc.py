import json, base64, sys, os
sys.path.insert(0,'src')

B  = json.load(open("tokens.json"))["themes"]["ember"]
C  = json.load(open("calendar/cal-tokens.json"))
GM = json.load(open("calendar/gcal-color-map.json"))
CSS = open("calendar/calendar-tokens.css").read()

def b64(p): return "data:image/svg+xml;base64,"+base64.b64encode(open(p,'rb').read()).decode()

LOGO_H   = b64("logos/A-n-motion-lockup-h.svg")
LOGO_HD  = b64("logos/A-lockup-h-dark.svg")
ICON     = b64("logos/A-n-motion-appicon.svg")
MARK     = b64("logos/A-n-motion.svg")

def ico(name, sz=16, sw=2):
    P = {
     "check":'<path d="M4 12.5 9.5 18 20 6.5"/>',
     "cal":'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
     "bell":'<path d="M18 10a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7"/><path d="M10.5 21a2 2 0 0 0 3 0"/>',
     "sync":'<path d="M21 12a9 9 0 0 1-15.5 6.2M3 12A9 9 0 0 1 18.5 5.8"/><path d="M3 20v-5h5M21 4v5h-5"/>',
     "warn":'<path d="M12 3.5 22 20H2z"/><path d="M12 10v4.5M12 17.6v.1"/>',
     "lock":'<rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
     "clock":'<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.4 2"/>',
     "x":'<path d="M6 6l12 12M18 6L6 18"/>',
     "arrow":'<path d="M4 12h15"/><path d="M13 6l6 6-6 6"/>',
     "spark":'<path d="M12 3v5M12 16v5M3 12h5M16 12h5"/><path d="M6.3 6.3 9.5 9.5M14.5 14.5l3.2 3.2M17.7 6.3 14.5 9.5M9.5 14.5l-3.2 3.2"/>',
    }[name]
    return (f'<svg class="i" viewBox="0 0 24 24" width="{sz}" height="{sz}" fill="none" '
            f'stroke="currentColor" stroke-width="{sw}" stroke-linecap="round" '
            f'stroke-linejoin="round">{P}</svg>')

# ---------------------------------------------------------------- components
def sync_badge(state, label):
    return f'<span class="badge b-{state}">{ico("sync",12,2.4)}{label}</span>'

def event_block(title, time, kind="nudge", prio=None, done=False, h=None, top=None, dur=None):
    cls = "done" if done else kind
    style = ""
    if top is not None and dur is not None:
        style = f'style="top:{top}px;height:{dur}px"'
    chip = f'<span class="p p-{prio}"></span>' if prio else ""
    tick = ico("check",11,3.2)+" " if done else ""
    return (f'<div class="evt e-{cls}" {style}>{chip}'
            f'<div class="evt-t">{tick}{title}</div><div class="evt-m">{time}</div></div>')

def day_view(mode):
    rows=""
    for h in range(9,18):
        rows+=f'<div class="hr"><span class="hlab">{h:02d}:00</span><div class="hline"></div></div>'
    ev = (event_block("Team Sync","09:00 – 09:45","ext",top=6,dur=52)
        + event_block("Complete Q4 proposal","10:00 – 11:30","nudge","urgent",top=68,dur=100)
        + event_block("Design review","11:45 – 12:15","nudge","normal",top=176,dur=36)
        + event_block("Client meeting","13:00 – 14:00","nudge","high",top=254,dur=68)
        + event_block("Code review","14:15 – 15:00","nudge","low",done=True,top=330,dur=52)
        + event_block("Focus block","15:30 – 17:00","nudge","normal",top=396,dur=100))
    return f'''<div class="dayv">
  <div class="dayv-h"><div><b>Friday, 15 August</b><span class="dim"> · 6 tasks</span></div>
  {sync_badge("ok","Synced 2m ago")}</div>
  <div class="dayv-b"><div class="hours">{rows}</div><div class="track">{ev}
  <div class="now" style="top:214px"><span></span></div></div></div>
</div>'''

def settings_panel():
    return '''<div class="panel">
  <div class="p-h">''' + ico("cal",17) + '''<b>Google Calendar</b>''' + sync_badge("ok","Connected") + '''</div>
  <div class="p-acct"><div class="av">A</div>
    <div><div class="p-nm">amina@studio.co</div><div class="dim sm">Primary · 4 calendars</div></div>
    <button class="btn ghost sm">Disconnect</button></div>
  <div class="fld"><label>Target calendar</label>
    <div class="sel">Primary — amina@studio.co <span class="car">▾</span></div></div>
  <div class="fld"><label>Sync direction</label>
    <div class="segs"><span class="seg on">Bidirectional</span><span class="seg">Nudge → GCal</span><span class="seg">GCal → Nudge</span></div></div>
  <div class="fld"><label>Default reminder</label>
    <div class="segs"><span class="seg">15m</span><span class="seg on">30m</span><span class="seg">1h</span><span class="seg">1d</span></div></div>
  <div class="fld"><label>Notify me via</label>
    <div class="tog on"><i></i>Push notification</div>
    <div class="tog on"><i></i>Email</div>
    <div class="tog"><i></i>SMS</div></div>
  <div class="fld"><label>When a task is completed</label>
    <div class="radios"><div class="rd on"><i></i>Mark the calendar event done</div>
    <div class="rd"><i></i>Delete the event</div><div class="rd"><i></i>Leave it unchanged</div></div></div>
  <div class="p-f"><button class="btn">Save settings</button></div>
</div>'''

def conflict_card():
    return '''<div class="panel">
  <div class="p-h warn">''' + ico("warn",17) + '''<b>Sync conflict</b>''' + sync_badge("conflict","Needs review") + '''</div>
  <div class="cf-body">
    <p class="cf-lead">"Complete Q4 proposal" changed in both places while you were offline.</p>
    <div class="cf-grid">
      <div class="cf-side"><div class="cf-lab">''' + ico("spark",12) + ''' In Nudge</div>
        <div class="cf-v">Fri 15 Aug · 10:00</div><div class="dim sm">edited 14:22</div></div>
      <div class="cf-side pick"><div class="cf-lab">''' + ico("cal",12) + ''' In Google Calendar</div>
        <div class="cf-v">Fri 15 Aug · 11:30</div><div class="dim sm">edited 14:31 · newer</div></div>
    </div>
    <div class="cf-act"><button class="btn sm">Keep Google's</button>
      <button class="btn ghost sm">Keep Nudge's</button>
      <button class="btn ghost sm">Keep both</button></div>
  </div></div>'''

def nudge_toast():
    return '''<div class="toast">
  <div class="t-ic">''' + ico("bell",16,2.2) + '''</div>
  <div class="t-b"><div class="t-t">Client meeting starts in 30 minutes</div>
  <div class="t-m">13:00 – 14:00 · synced to Google Calendar</div>
  <div class="t-a"><button class="btn sm">Mark done</button>
  <button class="btn ghost sm">Snooze 10m</button></div></div></div>'''

def task_row_states():
    return '''<div class="panel"><div class="p-h">''' + ico("check",17) + '''<b>Task row · sync states</b></div>
  <div class="trs">
    <div class="tr"><span class="cb"></span><div class="tb"><div class="tt">Send Q3 report to Amina</div>
      <div class="tm">Today 09:00 · Work</div></div>''' + sync_badge("ok","Synced") + '''</div>
    <div class="tr"><span class="cb"></span><div class="tb"><div class="tt">Book dentist</div>
      <div class="tm">Overdue 2d</div></div>''' + sync_badge("pending","Syncing…") + '''</div>
    <div class="tr"><span class="cb"></span><div class="tb"><div class="tt">Renew domain</div>
      <div class="tm">Tomorrow 12:00</div></div>''' + sync_badge("error","Token expired") + '''</div>
    <div class="tr"><span class="cb on">''' + ico("check",11,3.4) + '''</span>
      <div class="tb"><div class="tt strike">Reply to landlord</div>
      <div class="tm">Yesterday · event marked done</div></div>''' + sync_badge("ok","Synced") + '''</div>
    <div class="tr"><span class="cb"></span><div class="tb"><div class="tt">Water plants</div>
      <div class="tm">Sunday</div></div>''' + sync_badge("off","Not synced") + '''</div>
  </div></div>'''

def oauth_card():
    return '''<div class="panel oauth">
  <img class="oa-ic" src="''' + ICON + '''">
  <div class="oa-t">Connect Google Calendar</div>
  <p class="oa-p">Nudge will create and update events for tasks that have a due date.
  You can disconnect at any time.</p>
  <div class="scopes">
    <div class="sc">''' + ico("check",13,3) + '''<div><b>See your calendars</b><span>calendar.readonly</span></div></div>
    <div class="sc">''' + ico("check",13,3) + '''<div><b>Create &amp; update events</b><span>calendar.events</span></div></div>
  </div>
  <button class="btn wide">''' + ico("cal",15) + ''' Continue with Google</button>
  <div class="oa-f">''' + ico("lock",12) + ''' Tokens encrypted at rest · AES-256</div>
</div>'''

def demo(mode, inner, label):
    return (f'<div class="demo" data-theme="ember" {"data-mode=dark" if mode=="dark" else ""}>'
            f'<div class="demo-lab">{label}</div><div class="demo-in">{inner}</div></div>')

# ---------- colour map table ----------
rows=""
for role,v in GM.items():
    rows+=(f'<tr><td class="tk">{role}</td>'
           f'<td><i style="background:{v["nudge"]}"></i><code>{v["nudge"]}</code></td>'
           f'<td class="ar">{ico("arrow",13)}</td>'
           f'<td><code class="cid">{v["colorId"]}</code></td>'
           f'<td><i style="background:{v["googleHex"]}"></i>{v["google"]} <code>{v["googleHex"]}</code></td>'
           f'<td class="de">ΔE {v["dE"]}</td></tr>')
cmap_tbl=f'<table class="map"><thead><tr><th>Nudge role</th><th>Brand colour</th><th></th><th>colorId</th><th>Google renders</th><th>distance</th></tr></thead><tbody>{rows}</tbody></table>'

def tok_tbl(keys, title):
    r=""
    for k in keys:
        l=C["light"].get(k) or B["light"].get(k); d=C["dark"].get(k) or B["dark"].get(k)
        r+=(f'<tr><td class="tk">--{k}</td>'
            f'<td><i style="background:{l}"></i><code>{l}</code></td>'
            f'<td><i style="background:{d}"></i><code>{d}</code></td></tr>')
    return f'<div class="tw"><h4>{title}</h4><table class="tok"><thead><tr><th>token</th><th>light</th><th>dark</th></tr></thead><tbody>{r}</tbody></table></div>'

HTML = f'''<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Nudge × Google Calendar — branded integration spec</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
{CSS}
*{{box-sizing:border-box}}
html{{scroll-behavior:smooth}}
body{{margin:0;background:#FEFBF8;color:#332D26;font-family:"Plus Jakarta Sans",ui-sans-serif,system-ui,sans-serif;
 -webkit-font-smoothing:antialiased;line-height:1.5}}
.wrap{{max-width:1160px;margin:0 auto;padding:0 30px 110px}}
.i{{flex:none;vertical-align:-2px}}
/* ---- masthead ---- */
.mast{{padding:60px 0 30px}}
.mast img{{height:60px}}
.mast h1{{font-size:47px;font-weight:800;letter-spacing:-.035em;margin:26px 0 10px;line-height:1.05}}
.mast p{{font-size:17.5px;color:#655C52;max-width:64ch;margin:0;line-height:1.65}}
.kpis{{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}}
.kpi{{background:#FCF7EF;border:1px solid #F6DAB8;border-radius:12px;padding:9px 15px;font-size:12.5px;
 font-weight:700;color:#874000;display:flex;align-items:center;gap:7px}}
h2{{font-size:12.5px;text-transform:uppercase;letter-spacing:.15em;color:#7C7268;font-weight:700;
 margin:70px 0 8px;border-top:1px solid #EDE7E0;padding-top:22px}}
h2 span{{color:#C16900}}
.lede{{font-size:16px;color:#655C52;max-width:74ch;margin:0 0 26px;line-height:1.7}}
h3{{font-size:19px;font-weight:700;margin:34px 0 12px;letter-spacing:-.015em}}
h4{{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#7C7268;margin:0 0 9px;font-weight:700}}
p.n{{font-size:14.5px;color:#655C52;line-height:1.72;max-width:74ch}}
b.hl{{color:#332D26}}
code{{font-family:"JetBrains Mono",monospace;font-size:.88em}}
/* ---- demo frames ---- */
.duo{{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start}}
@media(max-width:900px){{.duo{{grid-template-columns:1fr}}}}
.demo{{border-radius:20px;overflow:hidden;border:1px solid #EDE7E0;background:var(--bg-canvas)}}
.demo-lab{{font-size:10px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;
 padding:9px 15px;color:var(--text-muted);background:var(--bg-sunken);border-bottom:1px solid var(--border-subtle)}}
.demo-in{{padding:18px}}
/* ---- primitives inside demos ---- */
.demo .panel{{background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:16px;overflow:hidden}}
.demo .p-h{{display:flex;align-items:center;gap:9px;padding:13px 15px;border-bottom:1px solid var(--border-subtle);
 font-size:14px;color:var(--text-primary)}}
.demo .p-h .badge{{margin-left:auto}}
.demo .p-h.warn{{color:var(--sync-conflict)}}
.badge{{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;
 padding:4px 9px;border-radius:99px;white-space:nowrap}}
.b-ok{{background:var(--sync-ok-bg);color:var(--sync-ok)}}
.b-pending{{background:var(--sync-pending-bg);color:var(--sync-pending)}}
.b-error{{background:var(--sync-error-bg);color:var(--sync-error)}}
.b-conflict{{background:var(--sync-conflict-bg);color:var(--sync-conflict)}}
.b-off{{background:var(--sync-off-bg);color:var(--sync-off)}}
.dim{{color:var(--text-muted)}} .sm{{font-size:11.5px}}
.btn{{background:var(--brand-solid);color:var(--text-inverse);border:none;border-radius:11px;
 padding:10px 16px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;
 display:inline-flex;align-items:center;gap:7px;transition:background 200ms cubic-bezier(.22,1,.36,1)}}
.btn:hover{{background:var(--brand-solid-hover)}}
.btn.ghost{{background:transparent;color:var(--text-secondary);border:1px solid var(--border-default)}}
.btn.sm{{padding:7px 12px;font-size:12px;border-radius:9px}}
.btn.wide{{width:100%;justify-content:center;padding:12px}}
/* settings */
.p-acct{{display:flex;align-items:center;gap:11px;padding:13px 15px;border-bottom:1px solid var(--border-subtle)}}
.av{{width:34px;height:34px;border-radius:50%;background:var(--brand-subtle-bg);color:var(--brand-text);
 display:grid;place-items:center;font-weight:800;font-size:14px;flex:none}}
.p-nm{{font-size:13px;font-weight:600;color:var(--text-primary)}}
.p-acct .btn{{margin-left:auto}}
.fld{{padding:13px 15px;border-bottom:1px solid var(--border-subtle)}}
.fld label{{display:block;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;
 color:var(--text-muted);margin-bottom:8px}}
.sel{{border:1px solid var(--border-default);border-radius:10px;padding:10px 12px;font-size:13px;
 color:var(--text-primary);display:flex;justify-content:space-between;background:var(--bg-surface)}}
.car{{color:var(--text-muted)}}
.segs{{display:flex;gap:6px;flex-wrap:wrap}}
.seg{{border:1px solid var(--border-default);border-radius:99px;padding:6px 12px;font-size:11.5px;
 font-weight:600;color:var(--text-secondary)}}
.seg.on{{background:var(--brand-solid);border-color:var(--brand-solid);color:var(--text-inverse)}}
.tog,.rd{{display:flex;align-items:center;gap:9px;font-size:13px;color:var(--text-primary);padding:5px 0}}
.tog i{{width:32px;height:19px;border-radius:99px;background:var(--bg-active);flex:none;position:relative;
 transition:background 200ms}}
.tog i::after{{content:"";position:absolute;top:2.5px;left:2.5px;width:14px;height:14px;border-radius:50%;
 background:var(--bg-surface);transition:transform 200ms cubic-bezier(.22,1,.36,1)}}
.tog.on i{{background:var(--brand-solid)}} .tog.on i::after{{transform:translateX(13px)}}
.rd i{{width:17px;height:17px;border-radius:50%;border:2px solid var(--border-strong);flex:none;position:relative}}
.rd.on i{{border-color:var(--brand-solid)}}
.rd.on i::after{{content:"";position:absolute;inset:3px;border-radius:50%;background:var(--brand-solid)}}
.p-f{{padding:13px 15px}}
/* task rows */
.trs .tr{{display:flex;align-items:center;gap:11px;padding:12px 15px;border-bottom:1px solid var(--border-subtle)}}
.trs .tr:last-child{{border-bottom:none}}
.cb{{width:19px;height:19px;border-radius:6px;border:2px solid var(--border-strong);flex:none;
 display:grid;place-items:center;color:var(--text-inverse)}}
.cb.on{{background:var(--brand-solid);border-color:var(--brand-solid)}}
.tb{{flex:1;min-width:0}}
.tt{{font-size:13.5px;font-weight:600;color:var(--text-primary)}}
.tt.strike{{text-decoration:line-through;opacity:.45}}
.tm{{font-size:11px;color:var(--text-muted);margin-top:2px}}
/* day view */
.dayv{{background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:16px;overflow:hidden}}
.dayv-h{{display:flex;align-items:center;padding:13px 15px;border-bottom:1px solid var(--border-subtle);
 font-size:13.5px;color:var(--text-primary)}}
.dayv-h .badge{{margin-left:auto}}
.dayv-b{{display:flex;padding:10px 14px 16px;gap:10px}}
.hours{{width:44px;flex:none;padding-top:6px}}
.hr{{height:56px;position:relative}}
.hlab{{font-size:9.5px;color:var(--text-muted);font-family:"JetBrains Mono",monospace}}
.track{{flex:1;position:relative;border-left:1px solid var(--grid-line-hour);padding-left:9px;min-height:510px}}
.evt{{position:absolute;left:9px;right:0;border-radius:9px;padding:6px 9px;overflow:hidden;
 border-left:3px solid}}
.e-nudge{{background:var(--evt-nudge-bg);border-color:var(--evt-nudge-br);color:var(--evt-nudge-tx)}}
.e-ext{{background:var(--evt-ext-bg);border-color:var(--evt-ext-br);color:var(--evt-ext-tx)}}
.e-done{{background:var(--evt-done-bg);border-color:var(--evt-done-br);color:var(--evt-done-tx)}}
.evt-t{{font-size:11.5px;font-weight:700;line-height:1.3;display:flex;align-items:center;gap:4px}}
.evt-m{{font-size:9.5px;opacity:.8;margin-top:1px}}
.p{{width:7px;height:7px;border-radius:50%;float:right;margin:3px 0 0 5px}}
.p-urgent{{background:var(--prio-urgent)}} .p-high{{background:var(--prio-high)}}
.p-normal{{background:var(--prio-normal)}} .p-low{{background:var(--prio-low)}}
.now{{position:absolute;left:0;right:0;height:2px;background:var(--grid-now)}}
.now span{{position:absolute;left:-4px;top:-3px;width:8px;height:8px;border-radius:50%;background:var(--grid-now)}}
/* conflict */
.cf-body{{padding:15px}}
.cf-lead{{font-size:13px;color:var(--text-secondary);margin:0 0 13px}}
.cf-grid{{display:grid;grid-template-columns:1fr 1fr;gap:10px}}
.cf-side{{border:1px solid var(--border-default);border-radius:11px;padding:11px}}
.cf-side.pick{{border-color:var(--brand-ring);background:var(--brand-subtle-bg)}}
.cf-lab{{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;
 color:var(--text-muted);display:flex;align-items:center;gap:5px;margin-bottom:6px}}
.cf-v{{font-size:13.5px;font-weight:700;color:var(--text-primary)}}
.cf-act{{display:flex;gap:7px;margin-top:13px;flex-wrap:wrap}}
/* toast */
.toast{{background:var(--bg-raised);border:1px solid var(--border-subtle);border-radius:15px;padding:13px;
 display:flex;gap:11px;box-shadow:0 12px 32px rgb(28 24 19/.12)}}
.t-ic{{width:34px;height:34px;border-radius:10px;background:var(--brand-subtle-bg);color:var(--brand-text);
 display:grid;place-items:center;flex:none}}
.t-t{{font-size:13.5px;font-weight:700;color:var(--text-primary)}}
.t-m{{font-size:11.5px;color:var(--text-muted);margin-top:2px}}
.t-a{{display:flex;gap:7px;margin-top:10px}}
/* oauth */
.oauth{{padding:22px;text-align:center}}
.oa-ic{{width:56px;border-radius:14px;margin-bottom:13px}}
.oa-t{{font-size:17px;font-weight:800;color:var(--text-primary);letter-spacing:-.015em}}
.oa-p{{font-size:12.5px;color:var(--text-secondary);margin:7px 0 15px;line-height:1.6}}
.scopes{{text-align:left;margin-bottom:15px;display:grid;gap:8px}}
.sc{{display:flex;gap:9px;align-items:flex-start;background:var(--bg-sunken);border-radius:10px;padding:10px 11px;
 color:var(--sync-ok)}}
.sc b{{display:block;font-size:12.5px;color:var(--text-primary);font-weight:600}}
.sc span{{font-size:10.5px;color:var(--text-muted);font-family:"JetBrains Mono",monospace}}
.oa-f{{font-size:10.5px;color:var(--text-muted);display:flex;align-items:center;justify-content:center;gap:5px}}
/* tables */
.map,.tok{{width:100%;border-collapse:collapse;font-size:12.5px;background:#fff;
 border:1px solid #EDE7E0;border-radius:14px;overflow:hidden}}
.map th,.tok th{{text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.09em;
 color:#7C7268;font-weight:700;padding:11px 12px;background:#FAF7F2;border-bottom:1px solid #EDE7E0}}
.map td,.tok td{{padding:9px 12px;border-bottom:1px solid #F6F1EA;white-space:nowrap}}
.map tr:last-child td,.tok tr:last-child td{{border-bottom:none}}
.tk{{font-family:"JetBrains Mono",monospace;font-size:11px;color:#655C52}}
.map i,.tok i{{display:inline-block;width:12px;height:12px;border-radius:3.5px;vertical-align:-1.5px;
 margin-right:6px;border:1px solid rgba(0,0,0,.15)}}
.cid{{background:#FCF7EF;border:1px solid #F6DAB8;border-radius:6px;padding:2px 7px;font-weight:700;color:#874000}}
.ar{{color:#C2B9AF;width:26px}} .de{{color:#9D9388;font-size:11px}}
.tw{{margin-bottom:18px}}
.grid2{{display:grid;grid-template-columns:1fr 1fr;gap:18px}}
@media(max-width:900px){{.grid2{{grid-template-columns:1fr}}}}
/* callouts */
.fix{{background:linear-gradient(135deg,#FFF5F4,#FEEAE8);border:1px solid #FCD4D1;border-radius:16px;
 padding:20px 22px;margin:20px 0}}
.fix h3{{margin:0 0 8px;font-size:16px;color:#8B3739;display:flex;align-items:center;gap:8px}}
.fix p{{margin:0;font-size:14px;color:#6E2B2C;line-height:1.7}}
.fix code{{background:#fff;border:1px solid #FCD4D1;border-radius:5px;padding:1px 6px;color:#8B3739}}
.tip{{background:linear-gradient(135deg,#FCF7EF,#FAEDDC);border:1px solid #F6DAB8;border-radius:16px;
 padding:20px 22px;margin:20px 0}}
.tip h3{{margin:0 0 8px;font-size:16px;color:#874000;display:flex;align-items:center;gap:8px}}
.tip p{{margin:0;font-size:14px;color:#6E2F00;line-height:1.7}}
pre{{background:#1D1813;color:#F0C08B;border-radius:14px;padding:18px 20px;overflow-x:auto;
 font-family:"JetBrains Mono",monospace;font-size:12px;line-height:1.65;margin:14px 0}}
pre .c{{color:#9D9388}} pre .k{{color:#E9A052}} pre .s{{color:#AED5BD}}
.flow{{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin:16px 0}}
.fnode{{background:#fff;border:1px solid #EDE7E0;border-radius:11px;padding:9px 13px;font-size:12.5px;
 font-weight:600;display:flex;align-items:center;gap:7px}}
.fnode.br{{background:#FCF7EF;border-color:#F6DAB8;color:#874000}}
.fnode.gc{{background:#F3F8FE;border-color:#CEE1F6;color:#2E5985}}
.fnode.ok{{background:#F3F9F5;border-color:#CEE5D7;color:#23644 5}}
.fsep{{color:#C2B9AF}}
</style></head><body><div class="wrap">

<div class="mast">
  <img src="{LOGO_H}">
  <h1>Google&nbsp;Calendar integration</h1>
  <p>The TaskMaster Pro integration plan, rebuilt in the Nudge identity — Mark&nbsp;A
  “n in motion” with the Ember palette, in both light and dark mode. Every screen below is
  live HTML driven by the same tokens you'd ship.</p>
  <div class="kpis">
    <div class="kpi">{ico("check",13,3)} 68/68 calendar pairs pass WCAG AA</div>
    <div class="kpi">{ico("warn",13)} 2 colour bugs found in the original spec</div>
    <div class="kpi">{ico("cal",13)} Light + dark throughout</div>
  </div>
</div>

<h2><span>01</span> · The colorId bug</h2>
<p class="lede">Before any styling: Google Calendar does not accept arbitrary hex for events.
<code>events.colorId</code> is a fixed 11-slot palette, and two mappings in the original spec
point at the wrong slot.</p>

<div class="fix">
  <h3>{ico("warn",17)} Completed tasks would have rendered purple</h3>
  <p>The spec maps <code>Completed → colorId "3"</code>. In Google's event palette,
  <b>3 is Grape (#8E24AA)</b> — purple, not the intended green. Green is <code>"10"</code> (Basil)
  or <code>"2"</code> (Sage). Separately, <code>Medium → "6"</code> is <b>Tangerine (#F4511E)</b>,
  a red-orange that is nearly indistinguishable from High's Tomato in a month view — the
  perceptual distance between them is only ΔE&nbsp;0.07. Both are corrected below.</p>
</div>

<p class="n">The mapping below is solved, not eyeballed. Each role is matched to a Google slot by
<b class="hl">OKLab distance</b> (hue and chroma weighted over lightness, since Google renders every
chip at its own fixed lightness), under two objectives at once: <b class="hl">fidelity</b> to the
brand colour, and <b class="hl">mutual separation</b> between the chosen slots. Separation is
weighted higher — what matters is that a user scanning a month view in Google can tell urgent from
high, and Google's palette is what they actually see. The chosen six are all at least ΔE&nbsp;0.13
apart.</p>
{cmap_tbl}
<p class="n" style="margin-top:14px">Inside Nudge's own UI you use the real brand colours; the
Google slot is only the bridge for how the event appears in Google's clients. Store the pair so
a re-sync never guesses.</p>

<h2><span>02</span> · Connect flow</h2>
<p class="lede">The OAuth consent moment is where users decide whether to trust the integration.
Lead with the app icon, name the scopes in plain language, and state the encryption promise.</p>
<div class="duo">
  {demo("light", oauth_card(), "Light")}
  {demo("dark",  oauth_card(), "Dark")}
</div>

<h2><span>03</span> · Sync status, everywhere</h2>
<p class="lede">Sync state is the single most important new signal this feature introduces.
Five states, each a token pair, so a row never has to guess how to render.</p>
<div class="duo">
  {demo("light", task_row_states(), "Light")}
  {demo("dark",  task_row_states(), "Dark")}
</div>
<div class="tip">
  <h3>{ico("bell",17)} Tone rule</h3>
  <p>“Token expired” uses <code>--sync-error</code>, which is a <b>desaturated brick</b>
  (<code>#AB4945</code>), not a pure alarm red. A failed sync is an inconvenience, not an
  emergency — and on a screen where five rows might all fail at once, saturated red would make
  the whole app feel broken. This is the Nudge tone principle applied to system state.</p>
</div>

<h2><span>04</span> · Calendar day view</h2>
<p class="lede">Nudge-owned events carry the brand tint and a priority dot; events from other
sources stay neutral so the user can always tell what this app created.</p>
<div class="duo">
  {demo("light", day_view("light"), "Light")}
  {demo("dark",  day_view("dark"),  "Dark")}
</div>

<h2><span>05</span> · Settings</h2>
<p class="lede">Everything from §4 of the original plan — calendar picker, sync direction,
reminder defaults, notification channels, completion behaviour — as real components.</p>
<div class="duo">
  {demo("light", settings_panel(), "Light")}
  {demo("dark",  settings_panel(), "Dark")}
</div>

<h2><span>06</span> · Conflict resolution &amp; reminders</h2>
<p class="lede">The spec's “last write wins, then notify” needs a UI. Show both values, mark
which is newer, and let the user decide — never silently discard their edit.</p>
<div class="duo">
  {demo("light", conflict_card(), "Light")}
  {demo("dark",  conflict_card(),  "Dark")}
</div>
<div class="duo" style="margin-top:18px">
  {demo("light", nudge_toast(), "Reminder · light")}
  {demo("dark",  nudge_toast(), "Reminder · dark")}
</div>

<h2><span>07</span> · Tokens</h2>
<p class="lede">Drop <code>calendar-tokens.css</code> in after <code>tokens.css</code>. Same
<code>data-theme</code> / <code>data-mode</code> switch as the core system.</p>
<div class="grid2">
  {tok_tbl(["sync-ok","sync-pending","sync-error","sync-conflict","sync-off"],"Sync state")}
  {tok_tbl(["prio-urgent","prio-high","prio-normal","prio-low"],"Priority")}
  {tok_tbl(["evt-nudge-bg","evt-nudge-br","evt-nudge-tx","evt-ext-bg","evt-ext-br","evt-ext-tx","evt-done-bg","evt-done-br","evt-done-tx"],"Event blocks")}
  {tok_tbl(["grid-line","grid-line-hour","grid-now","grid-today-bg","grid-busy-bg"],"Calendar grid")}
</div>

<h2><span>08</span> · Event payload</h2>
<p class="lede">The task → event transform, with the corrected colour bridge and the brand
signature in <code>extendedProperties</code>.</p>
<pre><span class="c">// Task → Google Calendar event</span>
{{
  summary: <span class="s">"Complete Q4 proposal"</span>,   <span class="c">// no emoji prefix — see note</span>
  description: <span class="s">"Prepare Q4 proposal with team\\n\\n"</span> +
               <span class="s">"Priority: Urgent · Category: Work\\n"</span> +
               <span class="s">"Open in Nudge → https://nudge.app/t/task_123"</span>,
  start: {{ dateTime: <span class="s">"2026-08-15T10:00:00"</span>, timeZone: <span class="s">"Africa/Nairobi"</span> }},
  end:   {{ dateTime: <span class="s">"2026-08-15T11:30:00"</span>, timeZone: <span class="s">"Africa/Nairobi"</span> }},
  <span class="k">colorId</span>: <span class="s">"11"</span>,                        <span class="c">// urgent → Tomato (was correct)</span>
  reminders: {{ useDefault: false, overrides: [
    {{ method: <span class="s">"popup"</span>, minutes: 30 }},
    {{ method: <span class="s">"email"</span>, minutes: 60 }} ]}},
  extendedProperties: {{ private: {{
    taskId:   <span class="s">"task_123"</span>,
    source:   <span class="s">"nudge"</span>,
    priority: <span class="s">"urgent"</span>,
    revision: <span class="s">"7"</span>,                    <span class="c">// bump on every write</span>
    hash:     <span class="s">"a3f9…"</span>                  <span class="c">// detect echo of our own webhook</span>
  }}}}
}}</pre>
<div class="tip">
  <h3>{ico("spark",17)} Two additions to the original payload</h3>
  <p><b>Drop the ✅ emoji prefix</b> from <code>summary</code> — it breaks alphabetical sort in
  Google's agenda, renders as tofu on some Android builds, and duplicates information the
  <code>colorId</code> already carries. <b>Add <code>revision</code> and <code>hash</code></b>:
  without them your webhook cannot distinguish a genuine user edit in Google from the echo of
  your own write, and you get an infinite sync loop. This is the most common way two-way
  calendar sync fails in production.</p>
</div>

<h2><span>09</span> · Sync loop guard</h2>
<div class="flow">
  <span class="fnode br">{ico("spark",13)} Nudge writes event</span><span class="fsep">→</span>
  <span class="fnode">store <code>hash</code></span><span class="fsep">→</span>
  <span class="fnode gc">{ico("cal",13)} Google fires webhook</span><span class="fsep">→</span>
  <span class="fnode">compare hash</span><span class="fsep">→</span>
  <span class="fnode ok">{ico("check",13,3)} match → ignore</span>
</div>
<div class="flow">
  <span class="fnode gc">{ico("cal",13)} User edits in Google</span><span class="fsep">→</span>
  <span class="fnode gc">{ico("cal",13)} webhook</span><span class="fsep">→</span>
  <span class="fnode">hash differs</span><span class="fsep">→</span>
  <span class="fnode br">{ico("sync",13)} apply to task</span><span class="fsep">→</span>
  <span class="fnode ok">{ico("check",13,3)} bump revision</span>
</div>
<p class="n">Pair this with the spec's last-write-wins rule and the conflict card in §6:
LWW resolves the data, the card tells the human it happened. Silent LWW is how users lose
trust in a sync feature.</p>

<h2><span>10</span> · What carries the brand</h2>
<p class="n">Three things make this integration feel like Nudge rather than a generic calendar
sync. <b class="hl">The trail lines</b> from the logo become the motion language: a row that
syncs slides 6px and settles, matching the mark's forward push. <b class="hl">Amber owns
“ours”</b> — every Nudge-created event is tinted, external events stay neutral grey, so the
brand colour literally maps to authorship. <b class="hl">Nothing shouts</b>: overdue tints
metadata, sync errors use a muted brick, and the only saturated colour on screen is the
current-time line. A calendar full of red is the fastest way to make a productivity app feel
like a punishment.</p>

</div></body></html>'''
open("calendar/nudge-google-calendar.html","w").write(HTML)
print("written", len(HTML), "bytes")
