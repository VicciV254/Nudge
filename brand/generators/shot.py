from playwright.sync_api import sync_playwright
import sys, os
def shot(html, out, width=1280, full=True, clip=None):
    with sync_playwright() as p:
        b=p.chromium.launch()
        pg=b.new_page(viewport={"width":width,"height":1200}, device_scale_factor=2)
        pg.goto("file://"+os.path.abspath(html))
        pg.wait_for_timeout(2500)
        pg.screenshot(path=out, full_page=full, clip=clip)
        h=pg.evaluate("document.body.scrollHeight")
        b.close()
        return h
if __name__=="__main__":
    h=shot(sys.argv[1], sys.argv[2])
    print("page height", h)
