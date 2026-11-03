import QRCode from "qrcode";

export type QrMatrix = { size: number; isDark: (row: number, column: number) => boolean };

/** A hole in the middle sized for a logo. High error correction lets scanners recover what's covered. */
const LOGO_FRACTION = 0.22;
const QUIET_ZONE = 4;

export function createQrMatrix(text: string, withLogo: boolean): QrMatrix {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: withLogo ? "H" : "M" });
  const { size, data } = modules;
  const logoSpan = withLogo ? Math.ceil(size * LOGO_FRACTION) | 1 : 0;
  const start = Math.floor((size - logoSpan) / 2);
  const end = start + logoSpan;

  return {
    size,
    isDark(row, column) {
      if (withLogo && row >= start && row < end && column >= start && column < end) return false;
      return Boolean(data[row * size + column]);
    },
  };
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export type QrOptions = {
  foreground: string;
  background: string;
  /** A data: URL chosen by the user in their own browser. */
  logo: string | null;
};

export function qrToSvg(matrix: QrMatrix, { foreground, background, logo }: QrOptions): string {
  const total = matrix.size + QUIET_ZONE * 2;
  const cells: string[] = [];
  for (let row = 0; row < matrix.size; row += 1) {
    for (let column = 0; column < matrix.size; column += 1) {
      if (matrix.isDark(row, column)) cells.push(`M${column + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`);
    }
  }

  const logoSpan = Math.ceil(matrix.size * LOGO_FRACTION) | 1;
  const logoAt = (total - logoSpan) / 2;
  const logoImage = logo
    ? `<image href="${escapeAttribute(logo)}" x="${logoAt + 0.5}" y="${logoAt + 0.5}" width="${logoSpan - 1}" height="${logoSpan - 1}" preserveAspectRatio="xMidYMid meet"/>`
    : "";

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">`,
    `<rect width="${total}" height="${total}" fill="${escapeAttribute(background)}"/>`,
    `<path d="${cells.join("")}" fill="${escapeAttribute(foreground)}"/>`,
    logoImage,
    "</svg>",
  ].join("");
}

/** Renders to RGBA pixels, shared by the PNG download and the tests that scan the code back. */
export function qrToPixels(matrix: QrMatrix, foreground: string, background: string, scale: number) {
  const total = matrix.size + QUIET_ZONE * 2;
  const width = total * scale;
  const pixels = new Uint8ClampedArray(width * width * 4);
  const parse = (hex: string) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  const dark = parse(foreground);
  const light = parse(background);

  for (let y = 0; y < width; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const row = Math.floor(y / scale) - QUIET_ZONE;
      const column = Math.floor(x / scale) - QUIET_ZONE;
      const inside = row >= 0 && column >= 0 && row < matrix.size && column < matrix.size;
      const color = inside && matrix.isDark(row, column) ? dark : light;
      const offset = (y * width + x) * 4;
      pixels.set([color[0], color[1], color[2], 255], offset);
    }
  }
  return { pixels, width };
}

export function logoBox(matrix: QrMatrix, scale: number) {
  const total = matrix.size + QUIET_ZONE * 2;
  const span = Math.ceil(matrix.size * LOGO_FRACTION) | 1;
  return { x: ((total - span) / 2 + 0.5) * scale, y: ((total - span) / 2 + 0.5) * scale, size: (span - 1) * scale };
}
