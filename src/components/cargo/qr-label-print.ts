/**
 * Geometry for the 35 × 25 mm cargo-item sticker, shared by the staff dashboard
 * and the public tracking page so both produce an identical label.
 *
 * The template is laid out at 132 × 94 CSS px (35 × 25 mm at 96 dpi) and
 * rasterised at 8× — roughly 760 dpi, comfortably above the 203–300 dpi of the
 * thermal printers these stickers go to, so the QR modules stay square.
 */
export const QR_LABEL_RENDER_OPTIONS = { width: 132, height: 94, pixelRatio: 8 };

export const QR_LABEL_PRINT_OPTIONS = {
  width: "35mm",
  height: "25mm",
  alt: "Cargo item QR label",
};
