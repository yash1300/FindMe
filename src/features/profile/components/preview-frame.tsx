"use client";

import { Monitor, Smartphone } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ProfileView, type ProfileViewData } from "./profile-view";

/**
 * A live preview in the page's own DOM, so it updates on every keystroke with no network calls
 * and can never be counted as public traffic. Links inside it don't navigate.
 */
export function PreviewFrame({ data }: { data: ProfileViewData }) {
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Live preview</p>
        <div role="group" aria-label="Preview size" className="flex gap-1">
          <Button type="button" size="icon-sm" variant={device === "mobile" ? "secondary" : "ghost"} aria-pressed={device === "mobile"} aria-label="Phone preview" onClick={() => setDevice("mobile")}>
            <Smartphone aria-hidden />
          </Button>
          <Button type="button" size="icon-sm" variant={device === "desktop" ? "secondary" : "ghost"} aria-pressed={device === "desktop"} aria-label="Desktop preview" onClick={() => setDevice("desktop")}>
            <Monitor aria-hidden />
          </Button>
        </div>
      </div>
      <div
        data-testid="live-preview"
        data-device={device}
        className={`mx-auto flex w-full flex-col overflow-y-auto rounded-2xl border bg-white shadow-sm transition-[max-width] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          device === "mobile" ? "max-w-[24rem]" : "max-w-full"
        }`}
        style={{ height: "min(70vh, 44rem)" }}
        onClickCapture={(event) => {
          if ((event.target as HTMLElement).closest("a")) event.preventDefault();
        }}
      >
        <ProfileView data={data} preview />
      </div>
    </div>
  );
}
