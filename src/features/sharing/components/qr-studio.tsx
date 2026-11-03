"use client";

import { Check, Copy, Download, Share2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button, buttonVariants } from "@/components/ui/button";
import { contrastRatio } from "@/features/themes/css";
import { buildShareTargets } from "../links";
import { createQrMatrix, logoBox, qrToPixels, qrToSvg } from "../qr";

const PNG_SCALE = 16;
const MAX_LOGO_BYTES = 1024 * 1024;

function download(href: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
}

export function QrStudio({ url, title, username }: { url: string; title: string; username: string }) {
  const [foreground, setForeground] = useState("#111827");
  const [background, setBackground] = useState("#ffffff");
  const [logo, setLogo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // navigator doesn't exist during server rendering, so this has to wait until after mounting.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanShare(typeof navigator.share === "function");
  }, []);

  const matrix = useMemo(() => createQrMatrix(url, Boolean(logo)), [url, logo]);
  const svg = useMemo(() => qrToSvg(matrix, { foreground, background, logo }), [matrix, foreground, background, logo]);
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const lowContrast = contrastRatio(foreground, background) < 3;
  const targets = buildShareTargets(url, title);

  function chooseLogo(file: File) {
    setError(null);
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > MAX_LOGO_BYTES) {
      setError("Use a PNG, JPEG or WebP logo of up to 1 MB.");
      return;
    }
    // Stays in the browser. The logo is never uploaded.
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function downloadPng() {
    const { pixels, width } = qrToPixels(matrix, foreground, background, PNG_SCALE);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = width;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, width), 0, 0);

    if (logo) {
      const image = new Image();
      image.src = logo;
      await image.decode();
      const box = logoBox(matrix, PNG_SCALE);
      context.drawImage(image, box.x, box.y, box.size, box.size);
    }
    download(canvas.toDataURL("image/png"), `findme-${username}.png`);
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <div className="grid gap-3 rounded-xl border bg-card p-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- A generated data: URL, which next/image can't optimise. */}
        <img src={svgDataUrl} alt={`QR code for ${url}`} data-testid="qr-preview" className="aspect-square w-full rounded-lg" />
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" onClick={() => void downloadPng()}><Download aria-hidden /> PNG</Button>
          <Button type="button" variant="outline" onClick={() => download(svgDataUrl, `findme-${username}.svg`)}><Download aria-hidden /> SVG</Button>
        </div>
      </div>

      <div className="grid gap-6">
        <section className="grid gap-4 rounded-xl border bg-card p-4">
          <h2 className="font-medium">Customise</h2>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Label htmlFor="qr-fg">Code colour</Label>
              <input id="qr-fg" type="color" value={foreground} onChange={(event) => setForeground(event.target.value)} className="size-8 cursor-pointer rounded-md border p-0.5" />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="qr-bg">Background</Label>
              <input id="qr-bg" type="color" value={background} onChange={(event) => setBackground(event.target.value)} className="size-8 cursor-pointer rounded-md border p-0.5" />
            </div>
          </div>
          {lowContrast ? (
            <p role="status" className="rounded-md bg-amber-50 p-2 text-xs text-amber-950">
              These colours are too similar, so this code may not scan. Test it with your phone before printing.
            </p>
          ) : null}
          <div className="grid gap-2">
            <p className="text-sm font-medium">Logo</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                aria-label="Choose a logo"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) chooseLogo(file);
                  event.target.value = "";
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}><Upload aria-hidden /> Choose logo</Button>
              {logo ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setLogo(null)}><X aria-hidden /> Remove</Button>
              ) : null}
            </div>
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            <p className="text-xs text-muted-foreground">Your logo stays on your device. Always test a code with your phone before printing it.</p>
          </div>
        </section>

        <section className="grid gap-4 rounded-xl border bg-card p-4">
          <h2 className="font-medium">Share your page</h2>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-1.5 text-sm" data-testid="profile-url">{url}</code>
            <Button type="button" variant="outline" onClick={() => void copyUrl()}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {canShare ? (
              <Button type="button" onClick={() => void navigator.share({ url, title }).catch(() => {})}>
                <Share2 aria-hidden /> Share
              </Button>
            ) : null}
            {targets.map((target) => (
              <a key={target.id} href={target.href} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
                {target.label}
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
