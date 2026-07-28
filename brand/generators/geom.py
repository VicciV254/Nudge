import math

def squircle(cx, cy, r, n=5.0, steps=240):
    """Superellipse (iOS-style squircle) path."""
    pts = []
    for i in range(steps):
        t = 2*math.pi*i/steps
        ct, st = math.cos(t), math.sin(t)
        x = cx + r*math.copysign(abs(ct)**(2/n), ct)
        y = cy + r*math.copysign(abs(st)**(2/n), st)
        pts.append((x, y))
    d = "M %.3f %.3f " % pts[0] + " ".join("L %.3f %.3f" % p for p in pts[1:]) + " Z"
    return d

def arc(cx, cy, r, a0, a1, sweep=1):
    """Arc path from angle a0 to a1 (degrees, 0=east, CW positive in SVG coords)."""
    x0, y0 = cx + r*math.cos(math.radians(a0)), cy + r*math.sin(math.radians(a0))
    x1, y1 = cx + r*math.cos(math.radians(a1)), cy + r*math.sin(math.radians(a1))
    large = 1 if abs(a1-a0) > 180 else 0
    return f"M {x0:.3f} {y0:.3f} A {r:.3f} {r:.3f} 0 {large} {sweep} {x1:.3f} {y1:.3f}"
