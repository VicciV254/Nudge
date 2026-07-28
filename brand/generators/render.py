import cairosvg, os, sys, glob
from PIL import Image, ImageDraw

def png(svg, out, w=256, bg='white'):
    cairosvg.svg2png(url=svg, write_to=out, output_width=w, output_height=w, background_color=bg)

def contact(files, out, cols=5, cell=200, pad=18, bg=(255,255,255), labels=None):
    rows = (len(files)+cols-1)//cols
    lab_h = 26 if labels else 0
    W = cols*(cell+pad)+pad
    H = rows*(cell+pad+lab_h)+pad
    sheet = Image.new('RGB', (W, H), bg)
    d = ImageDraw.Draw(sheet)
    for i, f in enumerate(files):
        r, c = divmod(i, cols)
        tmp = f'/tmp/_c{i}.png'
        png(f, tmp, cell, bg=None)
        im = Image.open(tmp).convert('RGBA')
        x = pad + c*(cell+pad); y = pad + r*(cell+pad+lab_h)
        sheet.paste(im, (x, y), im)
        if labels:
            d.text((x+2, y+cell+6), labels[i], fill=(60,60,60))
    sheet.save(out)
    return out
