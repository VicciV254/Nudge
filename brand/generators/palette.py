"""Generate perceptually-even color ramps in OKLCH, gamut-clip to sRGB, and WCAG-check."""
import math, json

# ---------- OKLab / OKLCH <-> sRGB ----------
def _lin(c):
    return c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)**2.4
def _unlin(c):
    return 12.92*c if c <= 0.0031308 else 1.055*(c**(1/2.4))-0.055

def oklch_to_srgb(L, C, H):
    h = math.radians(H)
    a, b = C*math.cos(h), C*math.sin(h)
    l_ = L + 0.3963377774*a + 0.2158037573*b
    m_ = L - 0.1055613458*a - 0.0638541728*b
    s_ = L - 0.0894841775*a - 1.2914855480*b
    l, m, s = l_**3, m_**3, s_**3
    r = +4.0767416621*l - 3.3077115913*m + 0.2309699292*s
    g = -1.2684380046*l + 2.6097574011*m - 0.3413193965*s
    bb = -0.0041960863*l - 0.7034186147*m + 1.7076147010*s
    return (r, g, bb)

def in_gamut(rgb, eps=1e-4):
    return all(-eps <= c <= 1+eps for c in rgb)

def clip_chroma(L, C, H):
    """Binary-search the largest chroma <= C that stays inside sRGB."""
    if in_gamut(oklch_to_srgb(L, C, H)):
        return C
    lo, hi = 0.0, C
    for _ in range(40):
        mid = (lo+hi)/2
        if in_gamut(oklch_to_srgb(L, mid, H)):
            lo = mid
        else:
            hi = mid
    return lo

def hexof(L, C, H):
    C = clip_chroma(L, C, H)
    r, g, b = oklch_to_srgb(L, C, H)
    out = []
    for c in (r, g, b):
        c = min(1.0, max(0.0, c))
        out.append(round(_unlin(c)*255))
    return "#%02X%02X%02X" % tuple(out)

# ---------- WCAG ----------
def rel_lum(hx):
    hx = hx.lstrip('#')
    r, g, b = [int(hx[i:i+2], 16)/255 for i in (0, 2, 4)]
    r, g, b = _lin(r), _lin(g), _lin(b)
    return 0.2126*r + 0.7152*g + 0.0722*b

def contrast(a, b):
    la, lb = rel_lum(a), rel_lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return round((hi+0.05)/(lo+0.05), 2)

def rating(cr, large=False):
    if large:
        return "AAA" if cr >= 4.5 else "AA" if cr >= 3 else "FAIL"
    return "AAA" if cr >= 7 else "AA" if cr >= 4.5 else "AA-lg" if cr >= 3 else "FAIL"

# ---------- ramp generation ----------
STEPS  = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
LIGHT  = [0.977, 0.952, 0.902, 0.838, 0.762, 0.685, 0.610, 0.532, 0.455, 0.385, 0.295]
CFRAC  = [0.055, 0.115, 0.225, 0.355, 0.505, 0.640, 0.700, 0.665, 0.575, 0.480, 0.365]

def ramp(hue, cmax, hue_shift=0.0):
    """hue_shift: total hue rotation applied linearly across the ramp (warm/cool drift)."""
    out = {}
    n = len(STEPS)
    for i, st in enumerate(STEPS):
        h = hue + hue_shift*(i/(n-1) - 0.5)*2
        out[st] = hexof(LIGHT[i], cmax*CFRAC[i], h)
    return out

def neutral(hue, cmax=0.016):
    out = {}
    L = [0.990, 0.972, 0.930, 0.878, 0.790, 0.690, 0.585, 0.480, 0.385, 0.300, 0.215]
    F = [0.25, 0.40, 0.55, 0.70, 0.85, 1.0, 1.0, 0.95, 0.85, 0.75, 0.65]
    for i, st in enumerate(STEPS):
        out[st] = hexof(L[i], cmax*F[i], hue)
    return out

# Higher-chroma curve for brand/primary ramps (more saturated mid-tones)
CFRAC_VIVID = [0.060, 0.130, 0.270, 0.440, 0.640, 0.830, 0.930, 0.900, 0.780, 0.640, 0.470]

def ramp_vivid(hue, cmax, hue_shift=0.0):
    out = {}
    n = len(STEPS)
    for i, st in enumerate(STEPS):
        h = hue + hue_shift*(i/(n-1) - 0.5)*2
        out[st] = hexof(LIGHT[i], cmax*CFRAC_VIVID[i], h)
    return out
