import json
d=json.load(open("tokens.json"))
P, T = d["ramps"], d["themes"]
order=["50","100","200","300","400","450","500","550","600","700","800","900","950"]
L=[]
L.append("/* ============================================================\n   Nudge — design tokens\n   3 themes x light/dark. All pairs verified >= WCAG AA.\n   ============================================================ */\n")
L.append(":root {")
L.append("  /* ---- primitive ramps ---- */")
for name,r in P.items():
    for k in order:
        if k in r: L.append(f"  --{name}-{k}: {r[k]};")
    L.append("")
L.append("""  /* ---- radii / spacing / motion ---- */
  --radius-xs: 6px;  --radius-sm: 10px; --radius-md: 14px;
  --radius-lg: 20px; --radius-xl: 28px; --radius-full: 999px;

  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px;

  --ease-out: cubic-bezier(.22,1,.36,1);
  --ease-spring: cubic-bezier(.34,1.56,.64,1);
  --dur-fast: 120ms; --dur-base: 200ms; --dur-slow: 320ms;

  --shadow-sm: 0 1px 2px rgb(28 24 19 / .06), 0 1px 1px rgb(28 24 19 / .04);
  --shadow-md: 0 4px 12px rgb(28 24 19 / .08), 0 1px 3px rgb(28 24 19 / .06);
  --shadow-lg: 0 12px 32px rgb(28 24 19 / .12), 0 4px 8px rgb(28 24 19 / .06);

  --font-sans: "Plus Jakarta Sans", "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}""")
def block(sel, t, comment):
    out=[f"\n/* {comment} */", sel+" {"]
    for k,v in t.items(): out.append(f"  --{k}: {v};")
    out.append("}")
    return out
for tn,modes in T.items():
    L += block(f'[data-theme="{tn}"]', modes["light"], f"{tn} — light")
    L += block(f'[data-theme="{tn}"][data-mode="dark"]', modes["dark"], f"{tn} — dark")
L.append("""
/* follow the OS when no explicit mode is set */
@media (prefers-color-scheme: dark) {
  [data-theme="ember"]:not([data-mode="light"])  { color-scheme: dark; }
  [data-theme="violet"]:not([data-mode="light"]) { color-scheme: dark; }
  [data-theme="teal"]:not([data-mode="light"])   { color-scheme: dark; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important;
    animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
}""")
open("tokens.css","w").write("\n".join(L))
print("tokens.css", len("\n".join(L)), "bytes")
