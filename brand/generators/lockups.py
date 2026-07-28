import os, math, re
from wordmark import wordmark_svg, DESC, ASC, SW
import make_logos as ML

OUT="logos"

def inner_of(svg):
    """strip outer <svg> tag, keep defs+content"""
    m = re.search(r'<svg[^>]*>(.*)</svg>', svg, re.S)
    return m.group(1)

def uniq(svg, suffix):
    """namespace gradient ids so multiple marks can coexist in one file"""
    for gid in re.findall(r'id="(g[A-Z])"', svg):
        svg = svg.replace(f'id="{gid}"', f'id="{gid}{suffix}"').replace(f'url(#{gid})', f'url(#{gid}{suffix})')
    return svg

def lockup_h(markfn, colors, name, text_color="#1D1813", mono=None, gap=0.16):
    mark = uniq(markfn(*colors) if not mono else markfn(mono=mono), name)
    wm, ww, wh = wordmark_svg(color=(mono or text_color))
    H = 512.0
    cap_h = H*0.60                      # wordmark cap box height
    s = cap_h/wh
    wmw = ww*s
    g = H*gap
    W = H + g + wmw
    mark_inner = inner_of(mark)
    wm_inner = inner_of(wm)
    y = (H - wh*s)/2
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.1f} {H:.1f}" '
            f'width="{W:.0f}" height="{H:.0f}" fill="none">\n'
            f'<g>{mark_inner}</g>\n'
            f'<g transform="translate({H+g:.2f},{y:.2f}) scale({s:.4f})">{wm_inner}</g>\n</svg>')

def lockup_v(markfn, colors, name, text_color="#1D1813", mono=None):
    mark = uniq(markfn(*colors) if not mono else markfn(mono=mono), name+"v")
    wm, ww, wh = wordmark_svg(color=(mono or text_color))
    M = 512.0
    tw = M*0.86
    s = tw/ww
    wmh = wh*s
    gap = M*0.10
    H = M + gap + wmh
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {M:.1f} {H:.1f}" '
            f'width="{M:.0f}" height="{H:.0f}" fill="none">\n'
            f'<g>{inner_of(mark)}</g>\n'
            f'<g transform="translate({(M-tw)/2:.2f},{M+gap:.2f}) scale({s:.4f})">{inner_of(wm)}</g>\n</svg>')

def squircle_path(cx,cy,r,n=5.0,steps=260):
    pts=[]
    for i in range(steps):
        t=2*math.pi*i/steps; ct,st=math.cos(t),math.sin(t)
        pts.append((cx+r*math.copysign(abs(ct)**(2/n),ct), cy+r*math.copysign(abs(st)**(2/n),st)))
    return "M %.2f %.2f "%pts[0]+" ".join("L %.2f %.2f"%p for p in pts[1:])+" Z"

def app_icon(markfn, name, bg_from, bg_to, mark_color="#FFFFFF", target=0.56):
    """Mark knocked out on a brand squircle, auto-centred on its true ink bbox
    and scaled so its largest dimension fills `target` of the tile."""
    from fit import ink_bbox
    S = 512.0
    mark = uniq(markfn(mono=mark_color), name+"icon")
    bb = ink_bbox(markfn(mono="#000"))
    x0,y0,x1,y1 = bb
    w,h = (x1-x0), (y1-y0)
    s = target/max(w,h)
    # centre the ink box in the tile
    cx,cy = (x0+x1)/2, (y0+y1)/2
    tx = S*(0.5 - cx*s)
    ty = S*(0.5 - cy*s)
    sq = squircle_path(S/2,S/2,S/2)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S:.0f} {S:.0f}" '
            f'width="{S:.0f}" height="{S:.0f}" fill="none">\n'
            f'<defs><linearGradient id="bg{name}" x1="0" y1="0" x2="{S}" y2="{S}" '
            f'gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="{bg_from}"/>'
            f'<stop offset="1" stop-color="{bg_to}"/></linearGradient></defs>\n'
            f'<path d="{sq}" fill="url(#bg{name})"/>\n'
            f'<g transform="translate({tx:.2f},{ty:.2f}) scale({s:.4f})">{inner_of(mark)}</g>\n</svg>')

if __name__=="__main__":
    picks = {"A-n-motion": (ML.mark_n, ("#C16900","#E9A052"), "#C16900","#E9A052"),
             "B-push":     (ML.mark_push, ("#C16900","#E9A052"), "#C16900","#E9A052"),
             "C-check":    (ML.mark_check, ("#007E70","#00B1A7"), "#00695E","#00A497"),
             "D-ping":     (ML.mark_ping, ("#8E59FF","#C3C3FF"), "#7C3AED","#A78BFA")}
    for n,(fn,cols,b1,b2) in picks.items():
        open(f"{OUT}/{n}-lockup-h.svg","w").write(lockup_h(fn,cols,n))
        open(f"{OUT}/{n}-lockup-v.svg","w").write(lockup_v(fn,cols,n))
        open(f"{OUT}/{n}-appicon.svg","w").write(app_icon(fn,n,b1,b2))
    # dark-bg lockup
    open(f"{OUT}/A-lockup-h-dark.svg","w").write(lockup_h(ML.mark_n,("#E9A052","#F0C08B"),"Adk",text_color="#F6EEE1"))
    open(f"{OUT}/wordmark-dark.svg","w").write(wordmark_svg(color="#F6EEE1")[0])
    print("lockups + icons written")
