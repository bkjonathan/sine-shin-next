/**
 * Shared helpers for turning an off-screen label/invoice template into a PNG
 * and either downloading or printing it. The templates live off-screen at
 * `position: fixed; left/top: -9999px`; these helpers momentarily reposition
 * the node on-screen (but invisible) so html-to-image can rasterise it, then
 * restore it.
 */

interface RenderPngOptions {
  width: number;
  /** Defaults to the node's scrollHeight (for variable-height templates). */
  height?: number;
  pixelRatio?: number;
}

export async function renderNodeToPng(el: HTMLElement, opts: RenderPngOptions): Promise<string> {
  el.style.position = "absolute";
  el.style.left = "0";
  el.style.top = "0";
  el.style.zIndex = "-9999";
  el.style.opacity = "0";
  el.style.pointerEvents = "none";
  try {
    await document.fonts.ready;
    await new Promise((r) => setTimeout(r, 300));

    const { toPng } = await import("html-to-image");
    return await toPng(el, {
      pixelRatio: opts.pixelRatio ?? 2,
      skipFonts: true,
      width: opts.width,
      height: opts.height ?? (el.scrollHeight || 700),
      style: {
        position: "static",
        left: "auto",
        top: "auto",
        opacity: "1",
      },
    });
  } finally {
    el.style.position = "fixed";
    el.style.left = "-9999px";
    el.style.top = "-9999px";
    el.style.zIndex = "";
    el.style.opacity = "";
    el.style.pointerEvents = "";
  }
}

interface PrintImageOptions {
  /** Physical page width as a CSS length, e.g. `"35mm"` or `"4in"`. */
  width: string;
  /** Physical page height as a CSS length, e.g. `"25mm"` or `"6in"`. */
  height: string;
  alt?: string;
}

/**
 * Prints a pre-rendered image at an exact physical size using a hidden iframe.
 * An iframe (rather than window.open) avoids pop-up blockers, and the `@page`
 * size hints the browser to the target media so a label printer driver receives
 * the right geometry.
 *
 * Two things here are load-bearing and easy to undo by accident:
 *
 * 1. **The iframe is sized to the label, not collapsed to 0×0.** A zero-sized
 *    frame is never laid out or painted, so Chrome prints whatever fragment of
 *    it exists — the classic "only half the label came out" bug, which bites
 *    hardest on small stock like 35×25mm.
 * 2. **The bitmap is decoded and given a paint tick before `print()`.** An
 *    image's `load` event only means the bytes arrived; printing in that same
 *    tick can capture a half-rendered image.
 *
 * The page box, the `<img>` and the iframe are all derived from the same two
 * values, so the three can never drift out of agreement.
 */
export function printImage(dataUrl: string, { width, height, alt = "Label" }: PrintImageOptions): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    Object.assign(iframe.style, {
      position: "fixed",
      left: "-10000px",
      top: "0",
      width,
      height,
      border: "0",
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      resolve();
      return;
    }

    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      setTimeout(() => iframe.remove(), 500);
      resolve();
    };

    doc.open();
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8"><style>` +
        // Width before height declares landscape stock; CSS has no way to say
        // `landscape` alongside explicit lengths, the dimensions are the
        // declaration.
        `@page { size: ${width} ${height}; margin: 0; }` +
        // Pinned to the page box rather than left to size themselves: left to
        // itself the document takes the frame's width, the image overflows it,
        // and whatever falls outside the page box is clipped — which prints as
        // a label with a slice missing off one edge.
        `html,body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }` +
        // Out of flow, so the body contributes no flow height. In-flow content
        // measured at exactly the page height rounds up by a sub-pixel and
        // spills a blank second sheet.
        //
        // `contain` rather than fixed mm: if a driver overrides the page box
        // (portrait stock, say) the label scales down whole instead of being
        // cropped in half.
        `img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; display: block; }` +
        `</style></head><body><img src="${dataUrl}" alt="${alt}" /></body></html>`
    );
    doc.close();

    const win = iframe.contentWindow;
    const img = doc.querySelector("img");

    const triggerPrint = async () => {
      if (!win) return cleanup();
      // Wait for the bitmap to be decoded and ready to paint, then let a couple
      // of frames go by. Driven off the parent window's clock — rAF inside an
      // off-screen frame can be throttled, and a print that never fires would
      // leave the button spinning.
      try {
        await img?.decode();
      } catch {
        /* decode() is best-effort; a failure here still prints */
      }
      await new Promise<void>((r) => {
        requestAnimationFrame(() => requestAnimationFrame(() => r()));
        setTimeout(r, 300);
      });

      win.onafterprint = cleanup;
      win.focus();
      win.print();
      // Fallback: some browsers never fire afterprint (or print is async).
      setTimeout(cleanup, 60000);
    };

    if (img && !img.complete) {
      img.onload = triggerPrint;
      img.onerror = () => cleanup();
    } else {
      triggerPrint();
    }
  });
}
