"use client";

import { Eye, EyeOff, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Field } from "@/components/forms/field";
import { SelectField } from "@/components/forms/select-field";
import { SortableList } from "@/components/forms/sortable-list";
import { Button } from "@/components/ui/button";
import type { OwnerSocialLink } from "@/features/profile/queries";
import type { ActionResult } from "@/features/profile/result";
import { deleteSocialLinkAction, reorderSocialLinksAction, saveSocialLinkAction, setSocialVisibilityAction } from "../actions";
import { SOCIAL_ICONS } from "../icons";
import { isSocialPlatform, platformLabel, SOCIAL_PLATFORMS, type SocialPlatformId } from "../platforms";

type Props = {
  initialLinks: OwnerSocialLink[];
  onChange?: (links: OwnerSocialLink[]) => void;
};

export function SocialManager({ initialLinks, onChange }: Props) {
  const [links, setLinksState] = useState(initialLinks);
  const used = new Set(links.map((link) => link.platform));
  const available = SOCIAL_PLATFORMS.filter((platform) => !used.has(platform.id));
  const [platform, setPlatform] = useState<SocialPlatformId>(available[0]?.id ?? "website");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  // A platform that has just been added can't stay selected.
  const selected = available.some((item) => item.id === platform) ? platform : available[0]?.id;
  const placeholder = SOCIAL_PLATFORMS.find((item) => item.id === selected)?.placeholder;

  function setLinks(next: OwnerSocialLink[]) {
    setLinksState(next);
    onChange?.(next);
  }

  function optimistic(next: OwnerSocialLink[], commit: () => Promise<ActionResult>) {
    const previous = links;
    setError(null);
    setLinks(next);
    startTransition(async () => {
      const result = await commit().catch((): ActionResult => ({ ok: false, message: "We couldn't reach the server. Your change wasn't saved." }));
      if (!result.ok) {
        setLinks(previous);
        setError(result.message);
      }
    });
  }

  function add(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setError(null);
    setFieldError(undefined);
    startTransition(async () => {
      const result = await saveSocialLinkAction({ platform: selected, url });
      if (result.ok) {
        setLinks([...links, result.link]);
        setUrl("");
      } else {
        setFieldError(result.fieldErrors?.url);
        if (!result.fieldErrors?.url) setError(result.message);
      }
    });
  }

  return (
    <div className="grid gap-4">
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

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
      <p className="text-xs text-muted-foreground">We check that each link goes to the right site, but not who owns the account.</p>
    </div>
  );
}
