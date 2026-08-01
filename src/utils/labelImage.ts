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
  /** CSS for the `@page` rule, e.g. `@page { size: 4in 6in; margin: 0; }`. */
  pageCss: string;
  /** CSS declarations applied to the `<img>`, e.g. `width: 4in; height: 6in;`. */
  imgCss: string;
  alt?: string;
}

/**
 * Prints a pre-rendered image using a hidden iframe. An iframe (rather than
 * window.open) avoids pop-up blockers, and the `@page` size hints the browser
 * to the target media so a label printer driver receives the right geometry.
 */
export function printImage(dataUrl: string, { pageCss, imgCss, alt = "Label" }: PrintImageOptions): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    Object.assign(iframe.style, {
      position: "fixed",
      right: "0",
      bottom: "0",
      width: "0",
      height: "0",
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
        pageCss +
        `html,body { margin: 0; padding: 0; }` +
        `img { ${imgCss} }` +
        `</style></head><body><img src="${dataUrl}" alt="${alt}" /></body></html>`
    );
    doc.close();

    const win = iframe.contentWindow;
    const img = doc.querySelector("img");

    const triggerPrint = () => {
      if (!win) return cleanup();
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
