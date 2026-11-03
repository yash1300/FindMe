"use client";

import { Play } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import type { Embed } from "@/features/blocks/embeds";

/**
 * Shows a light placeholder until the visitor presses play, so a page full of videos stays
 * fast and no third-party player or tracker loads for people who never watch.
 */
export function VideoPlayer({ embed }: { embed: Embed }) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="fm-video">
        <iframe
          src={embed.src}
          title={embed.title}
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        />
      </div>
    );
  }

  return (
    <div className="fm-video">
      {embed.thumbnail ? <Image src={embed.thumbnail} alt="" fill sizes="(max-width: 640px) 100vw, 36rem" style={{ objectFit: "cover" }} /> : null}
      <button type="button" className="fm-video-play" onClick={() => setPlaying(true)} aria-label={`Play ${embed.title}`}>
        <span>
          <Play aria-hidden fill="currentColor" />
        </span>
      </button>
    </div>
  );
}

export function AudioPlayer({ embed }: { embed: Embed }) {
  return (
    <iframe
      className="fm-embed"
      src={embed.src}
      title={embed.title}
      height={embed.height ?? 166}
      loading="lazy"
      allow="encrypted-media; clipboard-write"
      referrerPolicy="strict-origin-when-cross-origin"
      sandbox="allow-scripts allow-same-origin allow-popups"
    />
  );
}
