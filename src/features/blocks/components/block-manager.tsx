"use client";

import { Copy, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { SortableList } from "@/components/forms/sortable-list";
import { Button } from "@/components/ui/button";
import { PreviewFrame } from "@/features/profile/components/preview-frame";
import type { OwnerBlock, OwnerSocialLink } from "@/features/profile/queries";
import { type ActionResult, safely } from "@/features/profile/result";
import { toViewData } from "@/features/profile/to-view-data";
import { deleteBlockAction, duplicateBlockAction, reorderBlocksAction, setBlockVisibilityAction } from "../actions";
import { BLOCK_DEFINITIONS, BLOCK_GROUPS } from "../definitions";
import { blockState } from "../schedule";
import { BLOCK_TYPES, isBlockType, type BlockType } from "../schema";
import { BlockForm } from "./block-form";

type Props = {
  profile: { username: string; display_name: string; bio: string | null; avatar_path: string | null; cover_path: string | null; theme: unknown };
  initialBlocks: OwnerBlock[];
  socialLinks: OwnerSocialLink[];
  /** Opens the add menu straight away, for the dashboard's "Add link" shortcut. */
  startAdding?: boolean;
};

const STATE_LABELS = {
  hidden: { label: "Hidden", className: "bg-muted text-muted-foreground" },
  scheduled: { label: "Scheduled", className: "bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-100" },
  expired: { label: "Expired", className: "bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-100" },
} as const;

function AddMenu({ onChoose, onClose }: { onChoose: (type: BlockType) => void; onClose: () => void }) {
  return (
    <div className="grid gap-4 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Add a block</h2>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>
      {BLOCK_GROUPS.map((group) => (
        <div key={group} className="grid gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {BLOCK_TYPES.filter((type) => BLOCK_DEFINITIONS[type].group === group).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onChoose(type)}
                className="rounded-lg border p-3 text-left transition-colors hover:border-brand-violet hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="block text-sm font-medium">{BLOCK_DEFINITIONS[type].label}</span>
                <span className="block text-xs text-muted-foreground">{BLOCK_DEFINITIONS[type].description}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function BlockManager({ profile, initialBlocks, socialLinks, startAdding = false }: Props) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [adding, setAdding] = useState<"menu" | BlockType | null>(startAdding ? "menu" : null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [now, setNow] = useState<number | null>(null);

  // Set after mounting, because the server and browser clocks differ during hydration.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
  }, [blocks]);

  /** Shows a change at once, and puts everything back if the server refuses it. */
  function optimistic(next: OwnerBlock[], commit: () => Promise<ActionResult>) {
    const previous = blocks;
    setError(null);
    setBlocks(next);
    startTransition(async () => {
      let result: ActionResult;
      try {
        result = await commit();
      } catch {
        result = { ok: false, message: "We couldn't reach the server. Your change wasn't saved." };
      }
      if (!result.ok) {
        setBlocks(previous);
        setError(result.message);
      }
    });
  }

  function duplicate(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await safely(() => duplicateBlockAction(id));
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setBlocks((current) => {
        const all = [...current, result.block];
        return result.order.flatMap((orderId) => all.find((block) => block.id === orderId) ?? []);
      });
    });
  }

  function remove(id: string, label: string) {
    if (!window.confirm(`Delete this ${label.toLowerCase()}? This can't be undone.`)) return;
    optimistic(blocks.filter((block) => block.id !== id), () => deleteBlockAction(id));
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="grid min-w-0 gap-4">
        {error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}

        {adding === null ? (
          <Button type="button" className="justify-self-start" onClick={() => { setEditingId(null); setAdding("menu"); }}>
            <Plus aria-hidden /> Add block
          </Button>
        ) : null}

        {adding === "menu" ? <AddMenu onChoose={setAdding} onClose={() => setAdding(null)} /> : null}

        {adding && adding !== "menu" ? (
          <div className="grid gap-3 rounded-xl border bg-card p-4">
            <h2 className="font-medium">Add {BLOCK_DEFINITIONS[adding].label.toLowerCase()}</h2>
            <BlockForm
              type={adding}
              onCancel={() => setAdding("menu")}
              onSaved={(block) => {
                setBlocks((current) => [...current, block]);
                setAdding(null);
              }}
            />
          </div>
        ) : null}

        {blocks.length === 0 && adding === null ? (
          <div className="rounded-xl border border-dashed bg-card p-8 text-center">
            <p className="font-medium">Your page is empty</p>
            <p className="text-sm text-muted-foreground">Add your first link to get started.</p>
          </div>
        ) : null}

        <SortableList
          items={blocks}
          label={(block) => (isBlockType(block.type) ? BLOCK_DEFINITIONS[block.type].label : "block")}
          onReorder={(next) => optimistic(next, () => reorderBlocksAction(next.map((block) => block.id)))}
          renderItem={(block) => {
            if (!isBlockType(block.type)) return <p className="p-1 text-sm text-muted-foreground">Unknown block</p>;
            const definition = BLOCK_DEFINITIONS[block.type];
            const state = now === null ? null : blockState(block, now);

            if (editingId === block.id) {
              return (
                <div className="grid gap-3 p-1">
                  <h2 className="text-sm font-medium">Edit {definition.label.toLowerCase()}</h2>
                  <BlockForm
                    type={block.type}
                    block={block}
                    onCancel={() => setEditingId(null)}
                    onSaved={(saved) => {
                      setBlocks((current) => current.map((item) => (item.id === saved.id ? saved : item)));
                      setEditingId(null);
                    }}
                  />
                </div>
              );
            }

            const badge = state && state !== "live" ? STATE_LABELS[state] : null;
            return (
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-40 flex-1 py-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {definition.label}
                    {badge ? <span className={`rounded-full px-2 py-0.5 text-xs ${badge.className}`}>{badge.label}</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{definition.summary(block.config)}</p>
                </div>
                <div className="flex shrink-0 items-center">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={block.is_visible ? `Hide ${definition.label}` : `Show ${definition.label}`}
                    aria-pressed={!block.is_visible}
                    onClick={() =>
                      optimistic(
                        blocks.map((item) => (item.id === block.id ? { ...item, is_visible: !item.is_visible } : item)),
                        () => setBlockVisibilityAction(block.id, !block.is_visible),
                      )
                    }
                  >
                    {block.is_visible ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
                  </Button>
                  {definition.fields.length > 0 ? (
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={`Edit ${definition.label}`} onClick={() => { setAdding(null); setEditingId(block.id); }}>
                      <Pencil aria-hidden />
                    </Button>
                  ) : null}
                  <Button type="button" size="icon-sm" variant="ghost" aria-label={`Duplicate ${definition.label}`} onClick={() => duplicate(block.id)}>
                    <Copy aria-hidden />
                  </Button>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label={`Delete ${definition.label}`} onClick={() => remove(block.id, definition.label)}>
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>
            );
          }}
        />
      </div>

      <div className="xl:sticky xl:top-4">
        <PreviewFrame data={toViewData(profile, blocks, socialLinks)} />
      </div>
    </div>
  );
}
