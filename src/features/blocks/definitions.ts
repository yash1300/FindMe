import { BUTTON_VARIANTS, LINK_ICONS, type BlockType } from "./schema";

export type FieldDefinition = {
  name: string;
  label: string;
  kind: "text" | "textarea" | "url" | "email" | "tel" | "image" | "select";
  placeholder?: string;
  hint?: string;
  required?: boolean;
  options?: readonly { value: string; label: string }[];
};

type BlockDefinition = {
  label: string;
  description: string;
  group: "Links" | "Text" | "Media" | "Contact" | "Forms";
  fields: readonly FieldDefinition[];
  defaults: Record<string, string>;
  /** A short line for the block's row in the list. */
  summary: (config: Record<string, unknown>) => string;
};

const text = (value: unknown) => (typeof value === "string" ? value : "");

const ICON_OPTIONS = [
  { value: "", label: "No icon" },
  ...LINK_ICONS.map((icon) => ({ value: icon, label: icon.replace("-", " ").replace(/^./, (c) => c.toUpperCase()) })),
];

const VARIANT_OPTIONS = BUTTON_VARIANTS.map((variant) => ({
  value: variant,
  label: variant === "theme" ? "Same as theme" : variant.charAt(0).toUpperCase() + variant.slice(1),
}));

export const BLOCK_DEFINITIONS: Record<BlockType, BlockDefinition> = {
  link: {
    label: "Link",
    description: "A button that opens any web page",
    group: "Links",
    fields: [
      { name: "title", label: "Title", kind: "text", required: true, placeholder: "My website" },
      { name: "url", label: "Web address", kind: "url", required: true, placeholder: "https://example.com" },
      { name: "description", label: "Description", kind: "text", placeholder: "Optional line under the title" },
      { name: "thumbnailPath", label: "Thumbnail", kind: "image" },
      { name: "icon", label: "Icon", kind: "select", options: ICON_OPTIONS },
      { name: "variant", label: "Button style", kind: "select", options: VARIANT_OPTIONS },
    ],
    defaults: { title: "", url: "" },
    summary: (config) => `${text(config.title)} · ${text(config.url)}`,
  },
  featured_link: {
    label: "Featured link",
    description: "A larger card that stands out",
    group: "Links",
    fields: [
      { name: "title", label: "Title", kind: "text", required: true },
      { name: "url", label: "Web address", kind: "url", required: true, placeholder: "https://example.com" },
      { name: "description", label: "Description", kind: "textarea" },
      { name: "thumbnailPath", label: "Image", kind: "image" },
    ],
    defaults: { title: "", url: "" },
    summary: (config) => `${text(config.title)} · ${text(config.url)}`,
  },
  product_card: {
    label: "Product card",
    description: "Show something you sell, linking to where to buy it",
    group: "Links",
    fields: [
      { name: "title", label: "Product name", kind: "text", required: true },
      { name: "url", label: "Where to buy", kind: "url", required: true, placeholder: "https://example.com/shop" },
      { name: "description", label: "Description", kind: "textarea" },
      { name: "price", label: "Price", kind: "text", placeholder: "₹499", hint: "Shown as you type it. Sales happen on your own shop page." },
      { name: "imagePath", label: "Image", kind: "image" },
    ],
    defaults: { title: "", url: "" },
    summary: (config) => text(config.title),
  },
  social_icons: {
    label: "Social icons",
    description: "Show your social icons at this spot. Hide or delete it to take them off your page",
    group: "Links",
    fields: [],
    defaults: {},
    summary: () => "Your social icons from My Page appear here",
  },
  heading: {
    label: "Heading",
    description: "A title for a section",
    group: "Text",
    fields: [{ name: "text", label: "Heading", kind: "text", required: true }],
    defaults: { text: "" },
    summary: (config) => text(config.text),
  },
  text: {
    label: "Text",
    description: "A paragraph of plain text",
    group: "Text",
    fields: [{ name: "text", label: "Text", kind: "textarea", required: true }],
    defaults: { text: "" },
    summary: (config) => text(config.text).slice(0, 80),
  },
  announcement: {
    label: "Announcement",
    description: "A highlighted message, with an optional link",
    group: "Text",
    fields: [
      { name: "text", label: "Message", kind: "text", required: true },
      { name: "url", label: "Link", kind: "url", placeholder: "Optional" },
    ],
    defaults: { text: "" },
    summary: (config) => text(config.text),
  },
  divider: {
    label: "Divider",
    description: "A line between sections",
    group: "Text",
    fields: [],
    defaults: {},
    summary: () => "A line between sections",
  },
  image: {
    label: "Image",
    description: "A photo or graphic",
    group: "Media",
    fields: [
      { name: "path", label: "Image", kind: "image", required: true },
      { name: "alt", label: "Description for screen readers", kind: "text" },
      { name: "linkUrl", label: "Link", kind: "url", placeholder: "Optional" },
    ],
    defaults: {},
    summary: (config) => text(config.alt) || "Image",
  },
  youtube: {
    label: "YouTube",
    description: "Embed a YouTube video",
    group: "Media",
    fields: [{ name: "url", label: "YouTube link", kind: "url", required: true, placeholder: "https://youtu.be/..." }],
    defaults: { url: "" },
    summary: (config) => text(config.url),
  },
  video: {
    label: "Video",
    description: "Embed a YouTube or Vimeo video",
    group: "Media",
    fields: [{ name: "url", label: "Video link", kind: "url", required: true, placeholder: "https://vimeo.com/..." }],
    defaults: { url: "" },
    summary: (config) => text(config.url),
  },
  spotify: {
    label: "Spotify",
    description: "Embed a track, album, playlist or show",
    group: "Media",
    fields: [{ name: "url", label: "Spotify link", kind: "url", required: true, placeholder: "https://open.spotify.com/..." }],
    defaults: { url: "" },
    summary: (config) => text(config.url),
  },
  soundcloud: {
    label: "SoundCloud",
    description: "Embed a track or playlist",
    group: "Media",
    fields: [{ name: "url", label: "SoundCloud link", kind: "url", required: true, placeholder: "https://soundcloud.com/..." }],
    defaults: { url: "" },
    summary: (config) => text(config.url),
  },
  contact_info: {
    label: "Contact information",
    description: "Your email, phone or address, shown publicly",
    group: "Contact",
    fields: [
      { name: "email", label: "Email", kind: "email" },
      { name: "phone", label: "Phone", kind: "tel", placeholder: "+91 98765 43210" },
      { name: "address", label: "Address", kind: "textarea" },
    ],
    defaults: {},
    summary: (config) => [text(config.email), text(config.phone), text(config.address)].filter(Boolean).join(" · "),
  },
  email_button: {
    label: "Email button",
    description: "A button that starts an email to you",
    group: "Contact",
    fields: [
      { name: "label", label: "Button label", kind: "text", required: true, placeholder: "Email me" },
      { name: "email", label: "Email address", kind: "email", required: true },
    ],
    defaults: { label: "Email me", email: "" },
    summary: (config) => `${text(config.label)} · ${text(config.email)}`,
  },
  phone_button: {
    label: "Phone button",
    description: "A button that calls you",
    group: "Contact",
    fields: [
      { name: "label", label: "Button label", kind: "text", required: true, placeholder: "Call me" },
      { name: "phone", label: "Phone number", kind: "tel", required: true, placeholder: "+91 98765 43210" },
    ],
    defaults: { label: "Call me", phone: "" },
    summary: (config) => `${text(config.label)} · ${text(config.phone)}`,
  },
  newsletter: {
    label: "Newsletter form",
    description: "Collect email addresses, shown under Audience",
    group: "Forms",
    fields: [
      { name: "heading", label: "Heading", kind: "text", required: true },
      { name: "description", label: "Description", kind: "text" },
      { name: "buttonLabel", label: "Button label", kind: "text", required: true },
    ],
    defaults: { heading: "Join my newsletter", buttonLabel: "Subscribe" },
    summary: (config) => text(config.heading),
  },
  contact_form: {
    label: "Contact form",
    description: "Let visitors message you, shown under Audience",
    group: "Forms",
    fields: [
      { name: "heading", label: "Heading", kind: "text", required: true },
      { name: "buttonLabel", label: "Button label", kind: "text", required: true },
      { name: "field1", label: "Extra question 1", kind: "text", placeholder: "Optional, e.g. Your budget" },
      { name: "field2", label: "Extra question 2", kind: "text", placeholder: "Optional" },
      { name: "field3", label: "Extra question 3", kind: "text", placeholder: "Optional" },
    ],
    defaults: { heading: "Get in touch", buttonLabel: "Send message" },
    summary: (config) => text(config.heading),
  },
};

export const BLOCK_GROUPS = ["Links", "Text", "Media", "Contact", "Forms"] as const;
