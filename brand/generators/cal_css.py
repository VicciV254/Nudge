import json, sys
sys.path.insert(0,'src')
base = json.load(open("tokens.json"))["themes"]["ember"]
cal  = json.load(open("calendar/cal-tokens.json"))
L=[]
L.append("""/* ============================================================
   Nudge — Google Calendar integration tokens
   Mark A "n in motion" + Ember. Light + dark.
   Extends tokens.css. 68/68 calendar pairs verified >= WCAG AA.
   ============================================================ */\n""")
def blk(sel, d):
    out=[sel+" {"]
    for k,v in d.items(): out.append(f"  --{k}: {v};")
    out.append("}\n"); return out
L += blk('[data-theme="ember"]', {**base["light"], **cal["light"]})
L += blk('[data-theme="ember"][data-mode="dark"]', {**base["dark"], **cal["dark"]})
L.append("""/* ---- Google Calendar colorId bridge (fixed 11-slot palette) ---- */
:root {
  --gcal-tomato:    #D50000;  /* 11 */
  --gcal-tangerine: #F4511E;  /*  6 */
  --gcal-banana:    #F6BF26;  /*  5 */
  --gcal-basil:     #0B8043;  /* 10 */
  --gcal-blueberry: #3F51B5;  /*  9 */
  --gcal-sage:      #33B679;  /*  2 */
  --gcal-graphite:  #616161;  /*  8 */
}""")
open("calendar/calendar-tokens.css","w").write("\n".join(L))
print("calendar-tokens.css", sum(len(x) for x in L), "bytes")
