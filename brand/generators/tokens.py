from palette import *
import json

P = {
 "ember":  ramp_vivid(62,  0.200, hue_shift=-16),
 "violet": ramp_vivid(290, 0.260, hue_shift=14),
 "teal":   ramp_vivid(188, 0.150, hue_shift=-16),
 "sand":   neutral(70,  0.020),
 "slate":  neutral(280, 0.014),
 "stone":  neutral(180, 0.012),
 "green":  ramp(158, 0.150),
 "amber":  ramp(80,  0.165),
 "red":    ramp(25,  0.195),
 "blue":   ramp(252, 0.165),
}
# accessibility-tuned extras (solved, not guessed)
P["sand"]["550"]  = hexof(0.559,0.020,70);  P["sand"]["450"]  = hexof(0.670,0.020,70)
P["slate"]["550"] = hexof(0.559,0.014,280); P["slate"]["450"] = hexof(0.670,0.014,280)
P["stone"]["550"] = hexof(0.556,0.012,180); P["stone"]["450"] = hexof(0.667,0.012,180)

THEMES = {
 "ember":  {"brand":"ember","neutral":"sand"},
 "violet": {"brand":"violet","neutral":"slate"},
 "teal":   {"brand":"teal","neutral":"stone"},
}

def semantic(brand, neu, dark=False):
    B, N = P[brand], P[neu]
    if not dark:
        return {
          "bg-canvas":N[50], "bg-surface":"#FFFFFF", "bg-raised":"#FFFFFF",
          "bg-sunken":N[100], "bg-hover":N[100], "bg-active":N[200],
          "border-subtle":N[200], "border-default":N[300], "border-strong":N["450"],
          "text-primary":N[900], "text-secondary":N[700], "text-muted":N["550"],
          "text-inverse":"#FFFFFF", "text-disabled":N["450"],
          "brand-solid":B[700], "brand-solid-hover":B[800], "brand-text":B[800],
          "brand-subtle-bg":B[50], "brand-subtle-border":B[200], "brand-ring":B[600],
          "success":P["green"][700], "success-bg":P["green"][50],
          "warning":P["amber"][700], "warning-bg":P["amber"][50],
          "danger":P["red"][700],   "danger-bg":P["red"][50],
          "info":P["blue"][700],    "info-bg":P["blue"][50],
        }
    return {
      "bg-canvas":N[950], "bg-surface":N[900], "bg-raised":N[800],
      "bg-sunken":"#000000", "bg-hover":N[800], "bg-active":N[700],
      "border-subtle":N[800], "border-default":N[700], "border-strong":N[600],
      "text-primary":N[100], "text-secondary":N[300], "text-muted":N[400],
      "text-inverse":N[950], "text-disabled":N[600],
      "brand-solid":B[400], "brand-solid-hover":B[300], "brand-text":B[300],
      "brand-subtle-bg":B[950], "brand-subtle-border":B[800], "brand-ring":B[400],
      "success":P["green"][300], "success-bg":P["green"][950],
      "warning":P["amber"][300], "warning-bg":P["amber"][950],
      "danger":P["red"][300],    "danger-bg":P["red"][950],
      "info":P["blue"][300],     "info-bg":P["blue"][950],
    }

TOK = {}
for name, cfg in THEMES.items():
    TOK[name] = {"light":semantic(cfg["brand"],cfg["neutral"],False),
                 "dark": semantic(cfg["brand"],cfg["neutral"],True)}

if __name__ == "__main__":
    json.dump({"ramps":P,"themes":TOK}, open("tokens.json","w"), indent=2)
    # ---- audit ----
    checks=[("text-primary","bg-surface",4.5),("text-secondary","bg-surface",4.5),
            ("text-muted","bg-surface",4.5),("text-inverse","brand-solid",4.5),
            ("brand-text","bg-surface",4.5),("brand-ring","bg-surface",3.0),
            ("border-strong","bg-surface",3.0),("success","bg-surface",4.5),
            ("danger","bg-surface",4.5),("warning","bg-surface",4.5),("info","bg-surface",4.5),
            ("text-primary","bg-canvas",4.5),("text-muted","bg-canvas",4.5)]
    bad=0; total=0
    for tn,modes in TOK.items():
        for mode,t in modes.items():
            for fg,bg,need in checks:
                cr=contrast(t[fg],t[bg]); total+=1
                if cr<need:
                    bad+=1; print(f"FAIL {tn}/{mode} {fg} on {bg} = {cr} (need {need})")
    print(f"\n{total-bad}/{total} pass")
