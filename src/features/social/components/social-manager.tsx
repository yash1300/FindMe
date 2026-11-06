"use client";

import { Eye, EyeOff, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Field } from "@/components/forms/field";
import { SelectField } from "@/components/forms/select-field";
import { SortableList } from "@/components/forms/sortable-list";
import { Button } from "@/components/ui/button";
import type { OwnerBlock, OwnerSocialLink } from "@/features/profile/queries";
import { type ActionResult, OFFLINE_MESSAGE, safely } from "@/features/profile/result";
import {
  addSocialButtonsAction,
  deleteSocialLinkAction,
  reorderSocialLinksAction,
  saveSocialLinkAction,
  setSocialVisibilityAction,
  showSocialIconsAction,
} from "../actions";
import { SOCIAL_ICONS } from "../icons";
import { isSocialPlatform, platformLabel, SOCIAL_PLATFORMS, type SocialPlatformId } from "../platforms";

type Props = {
  initialLinks: OwnerSocialLink[];
  /** The page's blocks, to tell the creator when the Social icons block keeps their icons off the page. */
  initialBlocks?: OwnerBlock[];
  onChange?: (links: OwnerSocialLink[]) => void;
  /** For a live preview, because adding or removing a link can change the page's buttons too. */
  onBlocksChange?: (blocks: OwnerBlock[]) => void;
};

export function SocialManager({ initialLinks, initialBlocks, onChange, onBlocksChange }: Props) {
  const [links, setLinksState] = useState(initialLinks);
  const [blocks, setBlocksState] = useState(initialBlocks);
  const used = new Set(links.map((link) => link.platform));
  const available = SOCIAL_PLATFORMS.filter((platform) => !used.has(platform.id));
  const [platform, setPlatform] = useState<SocialPlatformId>(available[0]?.id ?? "website");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // A platform that has just been added can't stay selected.
  const selected = available.some((item) => item.id === platform) ? platform : available[0]?.id;
  const placeholder = SOCIAL_PLATFORMS.find((item) => item.id === selected)?.placeholder;

  function setLinks(next: OwnerSocialLink[]) {
    setLinksState(next);
    onChange?.(next);
  }

  function setBlocks(next: OwnerBlock[]) {
    setBlocksState(next);
    onBlocksChange?.(next);
  }

  const iconsBlock = blocks?.find((block) => block.type === "social_icons");
  const iconsOff = blocks && links.some((link) => link.is_visible) ? (!iconsBlock ? "deleted" : !iconsBlock.is_visible ? "hidden" : null) : null;

  function showIcons() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await safely(() => showSocialIconsAction());
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (result.blocks) setBlocks(result.blocks);
      setNotice("Your social icons are back on your page. Move them on the Links page.");
    });
  }

  function optimistic(next: OwnerSocialLink[], commit: () => Promise<ActionResult<{ blocks?: OwnerBlock[] }>>) {
    const previous = links;
    setError(null);
    setNotice(null);
    setLinks(next);
    startTransition(async () => {
      const result = await commit().catch((): ActionResult<{ blocks?: OwnerBlock[] }> => ({ ok: false, message: OFFLINE_MESSAGE }));
      if (!result.ok) {
        setLinks(previous);
        setError(result.message);
      } else if (result.blocks) {
        setBlocks(result.blocks);
      }
    });
  }

  function addMissingButtons() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await safely(() => addSocialButtonsAction());
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNotice(result.message);
      if (result.blocks) setBlocks(result.blocks);
    });
  }

  function add(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setError(null);
    setFieldError(undefined);
    setNotice(null);
    startTransition(async () => {
      const result = await safely(() => saveSocialLinkAction({ platform: selected, url }));
      if (result.ok) {
        setLinks([...links, result.link]);
        setUrl("");
        setNotice(result.notice ?? null);
        if (result.blocks) setBlocks(result.blocks);
      } else {
        setFieldError(result.fieldErrors?.url);
        if (!result.fieldErrors?.url) setError(result.message);
      }
    });
  }

  return (
    <div className="grid gap-4">
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p role="status" className="rounded-lg border bg-muted p-3 text-sm">{notice}</p> : null}
      {iconsOff ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <p className="min-w-0 flex-1 basis-60">
            These icons aren&apos;t on your page, because you {iconsOff === "hidden" ? "hid" : "deleted"} its Social icons block. Their buttons still show unless you hide them.
          </p>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={showIcons}>Show icons on my page</Button>
        </div>
      ) : null}

      {links.length > 0 ? (
        <SortableList
          items={links}
          label={(link) => (isSocialPlatform(link.platform) ? platformLabel(link.platform) : "link")}
          onReorder={(next) => optimistic(next, () => reorderSocialLinksAction(next.map((link) => link.id)))}
          renderItem={(link) => {
            const id = isSocialPlatform(link.platform) ? link.platform : "website";
            const Icon = SOCIAL_ICONS[id];
            const label = platformLabel(id);
            return (
              <div className="flex items-center gap-2 py-1">
                <Icon className="size-4 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="truncate text-xs text-muted-foreground">{link.url.replace(/^mailto:/, "")}</p>
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={link.is_visible ? `Hide ${label}` : `Show ${label}`}
                  aria-pressed={!link.is_visible}
                  onClick={() =>
                    optimistic(
                      links.map((item) => (item.id === link.id ? { ...item, is_visible: !item.is_visible } : item)),
                      () => setSocialVisibilityAction(link.id, !link.is_visible),
                    )
                  }
                >
                  {link.is_visible ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${label}`}
                  onClick={() => optimistic(links.filter((item) => item.id !== link.id), () => deleteSocialLinkAction(link.id))}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            );
          }}
        />
      ) : null}

      {selected ? (
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-start" noValidate>
          <SelectField
            id="social-platform"
            label="Platform"
            value={selected}
            options={available.map((item) => ({ value: item.id, label: item.label }))}
            onChange={(event) => {
              setPlatform(event.target.value as SocialPlatformId);
              setFieldError(undefined);
            }}
          />
          <Field
            name="url"
            id="social-url"
            label={selected === "email" ? "Email address" : "Link"}
            value={url}
            placeholder={placeholder}
            onChange={(event) => setUrl(event.target.value)}
            error={fieldError}
          />
          <Button type="submit" variant="outline" disabled={pending || !url.trim()} className="sm:mt-[1.375rem]">Add</Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">You&apos;ve added every available platform.</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 basis-60 text-xs text-muted-foreground">
          Each link appears as an icon, wherever the Social icons block sits on your Links page, and as a button you can edit there. We check that it goes to the right site, but not who owns the account.
        </p>
        {links.length > 0 ? (
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={addMissingButtons}>Add buttons for my links</Button>
        ) : null}
      </div>
    </div>
  );
}
