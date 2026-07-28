"""Measure real ink bbox of an SVG by rendering its alpha channel."""
import cairosvg, io, re
from PIL import Image

def ink_bbox(svg_str, res=512):
    png = cairosvg.svg2png(bytestring=svg_str.encode(), output_width=res, output_height=res,
                           background_color=None)
    im = Image.open(io.BytesIO(png)).convert('RGBA')
    bb = im.split()[3].getbbox()
    if not bb: return None
    # normalise to 0..1 of the viewBox
    return tuple(v/res for v in bb)   # (x0,y0,x1,y1)
