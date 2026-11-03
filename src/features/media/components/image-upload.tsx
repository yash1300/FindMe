"use client";

import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import Image from "next/image";
import { useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { uploadMediaAction } from "../actions";
import { MEDIA_MAX_BYTES, publicMediaUrl } from "../paths";

type Props = {
  label: string;
  value: string | null;
  onChange: (path: string | null) => void;
  hint?: string;
};

export function ImageUpload({ label, value, onChange, hint }: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const preview = publicMediaUrl(value);

  function upload(file: File) {
    setError(null);
    // Checked here too, so that a large file fails instantly rather than after a long upload.
    if (file.size > MEDIA_MAX_BYTES) {
      setError("That image is too large. The limit is 5 MB.");
      return;
    }
    const data = new FormData();
    data.set("file", file);
    startTransition(async () => {
      const result = await uploadMediaAction(data);
      if (result.ok) onChange(result.path);
      else setError(result.message);
    });
  }

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <div className="flex items-center gap-3">
        <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted text-muted-foreground">
          {preview ? <Image src={preview} alt="" fill sizes="64px" style={{ objectFit: "cover" }} /> : <ImagePlus className="size-5" aria-hidden />}
        </div>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload(file);
            event.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => inputRef.current?.click()}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {pending ? "Uploading…" : preview ? "Replace" : "Upload"}
        </Button>
        {preview ? (
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => onChange(null)} aria-label={`Remove ${label}`}>
            <Trash2 aria-hidden />
          </Button>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
