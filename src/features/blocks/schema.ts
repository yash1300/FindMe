import { z } from "zod";
import { mediaPathSchema } from "@/features/media/paths";
import { emailAddressSchema, httpUrlSchema, phoneSchema } from "@/lib/urls";
import { parseSoundCloud, parseSpotify, parseVideo, parseYouTube } from "./embeds";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .transform((value) => value || undefined)
    .optional();

const requiredText = (label: string, max: number) =>
  z.string().trim().min(1, `Enter ${label}.`).max(max, `Use at most ${max} characters.`);

const optionalUrl = z
  .union([z.literal("").transform(() => undefined), httpUrlSchema])
  .optional();

const optionalMedia = z
  .union([z.literal("").transform(() => undefined), mediaPathSchema])
  .optional();

export const LINK_ICONS = [
  "link", "globe", "shopping-bag", "calendar", "mail", "music", "video", "camera", "book-open",
  "heart", "star", "download", "briefcase", "map-pin", "phone", "gift",
] as const;
export type LinkIcon = (typeof LINK_ICONS)[number];

export const BUTTON_VARIANTS = ["theme", "filled", "outline", "soft"] as const;

const embedUrl = (parser: (url: string) => unknown, message: string) =>
  httpUrlSchema.refine((url) => parser(url) !== null, message);

export const BLOCK_SCHEMAS = {
  link: z.object({
    title: requiredText("a title", 100),
    url: httpUrlSchema,
    description: optionalText(200),
    thumbnailPath: optionalMedia,
    icon: z.enum(LINK_ICONS).optional(),
    variant: z.enum(BUTTON_VARIANTS).optional(),
  }),
  featured_link: z.object({
    title: requiredText("a title", 100),
    url: httpUrlSchema,
    description: optionalText(300),
    thumbnailPath: optionalMedia,
  }),
  social_icons: z.object({}),
  heading: z.object({ text: requiredText("a heading", 120) }),
  text: z.object({ text: requiredText("some text", 2000) }),
  image: z.object({
    path: mediaPathSchema,
    alt: optionalText(200),
    linkUrl: optionalUrl,
  }),
  youtube: z.object({
    url: embedUrl(parseYouTube, "Paste a link to a YouTube video."),
  }),
  video: z.object({
    url: embedUrl(parseVideo, "Paste a link to a YouTube or Vimeo video."),
  }),
  spotify: z.object({
    url: embedUrl(parseSpotify, "Paste a Spotify link to a track, album, playlist, artist or show."),
  }),
  soundcloud: z.object({
    url: embedUrl(parseSoundCloud, "Paste a link to a SoundCloud track or playlist."),
  }),
  contact_info: z
    .object({
      email: z.union([z.literal("").transform(() => undefined), emailAddressSchema]).optional(),
      phone: z.union([z.literal("").transform(() => undefined), phoneSchema]).optional(),
      address: optionalText(300),
    })
    .refine((value) => value.email || value.phone || value.address, "Add at least one way to reach you."),
  email_button: z.object({ label: requiredText("a label", 60), email: emailAddressSchema }),
  phone_button: z.object({ label: requiredText("a label", 60), phone: phoneSchema }),
  divider: z.object({}),
  announcement: z.object({ text: requiredText("an announcement", 200), url: optionalUrl }),
  product_card: z.object({
    title: requiredText("a product name", 100),
    url: httpUrlSchema,
    description: optionalText(300),
    // A label chosen by the creator. FindMe doesn't process this sale, so it isn't an amount.
    price: optionalText(30),
    imagePath: optionalMedia,
  }),
  newsletter: z.object({
    heading: requiredText("a heading", 100),
    description: optionalText(200),
    buttonLabel: requiredText("a button label", 40),
  }),
  contact_form: z.object({
    heading: requiredText("a heading", 100),
    buttonLabel: requiredText("a button label", 40),
  }),
} as const;

export type BlockType = keyof typeof BLOCK_SCHEMAS;
export const BLOCK_TYPES = Object.keys(BLOCK_SCHEMAS) as BlockType[];
export type BlockConfig<T extends BlockType> = z.output<(typeof BLOCK_SCHEMAS)[T]>;

export type RenderableBlock = {
  [T in BlockType]: { id: string; type: T; config: BlockConfig<T> };
}[BlockType];

export function isBlockType(value: unknown): value is BlockType {
  return typeof value === "string" && Object.hasOwn(BLOCK_SCHEMAS, value);
}

export function parseBlockConfig(type: BlockType, config: unknown) {
  return BLOCK_SCHEMAS[type].safeParse(config);
}

/** Re-validates a stored row at render. Anything invalid is dropped rather than shown. */
export function toRenderableBlock(row: { id: string; type: string; config: unknown }): RenderableBlock | null {
  if (!isBlockType(row.type)) return null;
  const parsed = parseBlockConfig(row.type, row.config);
  if (!parsed.success) return null;
  return { id: row.id, type: row.type, config: parsed.data } as RenderableBlock;
}

/** Dates as ISO strings. A schedule that ends before it starts is rejected. */
export const blockScheduleSchema = z
  .object({
    startsAt: z.iso.datetime({ offset: true }).nullable().optional(),
    endsAt: z.iso.datetime({ offset: true }).nullable().optional(),
  })
  .refine((value) => !value.startsAt || !value.endsAt || new Date(value.endsAt) > new Date(value.startsAt), {
    path: ["endsAt"],
    message: "The end must be after the start.",
  });

export const SCHEDULABLE_TYPES: readonly BlockType[] = BLOCK_TYPES;
