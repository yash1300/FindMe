import {
  BookOpen,
  Briefcase,
  Calendar,
  Camera,
  Download,
  Gift,
  Globe,
  Heart,
  Link as LinkIconGlyph,
  Mail,
  MapPin,
  Music,
  Phone,
  ShoppingBag,
  Star,
  Video,
} from "lucide-react";
import Image from "next/image";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { parseSoundCloud, parseSpotify, parseVideo, parseYouTube } from "@/features/blocks/embeds";
import type { LinkIcon, RenderableBlock } from "@/features/blocks/schema";
import { publicMediaUrl } from "@/features/media/paths";
import { SOCIAL_ICONS } from "@/features/social/icons";
import { platformLabel, type SocialPlatformId } from "@/features/social/platforms";
import { AudioPlayer, VideoPlayer } from "./embed-player";
import { ContactForm, NewsletterForm } from "./lead-forms";

const LINK_ICONS: Record<LinkIcon, ComponentType<SVGProps<SVGSVGElement>>> = {
  link: LinkIconGlyph,
  globe: Globe,
  "shopping-bag": ShoppingBag,
  calendar: Calendar,
  mail: Mail,
  music: Music,
  video: Video,
  camera: Camera,
  "book-open": BookOpen,
  heart: Heart,
  star: Star,
  download: Download,
  briefcase: Briefcase,
  "map-pin": MapPin,
  phone: Phone,
  gift: Gift,
};

// nofollow and ugc tell search engines these are user-submitted links, which discourages link spam.
const EXTERNAL = { target: "_blank", rel: "noopener noreferrer nofollow ugc" } as const;

export type RenderContext = {
  buttonStyle: "filled" | "outline" | "soft" | "glass";
  showIcons: boolean;
  ownerName: string;
  socialLinks: { id: string; platform: SocialPlatformId; url: string }[];
  preview: boolean;
};

function Button({
  href,
  external = true,
  style,
  icon,
  thumbnail,
  children,
  description,
}: {
  href: string;
  external?: boolean;
  style: string;
  icon?: ReactNode;
  thumbnail?: string | null;
  description?: string;
  children: ReactNode;
}) {
  return (
    <a href={href} className="fm-button" data-style={style} {...(external ? EXTERNAL : {})}>
      {thumbnail ? (
        <span className="fm-button-thumb">
          <Image src={thumbnail} alt="" fill sizes="36px" style={{ objectFit: "cover" }} />
        </span>
      ) : (
        icon ?? null
      )}
      <span className="fm-button-body">
        {children}
        {description ? <span className="fm-button-description">{description}</span> : null}
      </span>
      {thumbnail || icon ? <span className="fm-button-spacer" aria-hidden /> : null}
    </a>
  );
}

export function SocialIcons({ links }: { links: RenderContext["socialLinks"] }) {
  if (links.length === 0) return null;
  return (
    <nav className="fm-social" aria-label="Social links">
      {links.map((link) => {
        const Icon = SOCIAL_ICONS[link.platform];
        return (
          <a key={link.id} href={link.url} aria-label={platformLabel(link.platform)} {...EXTERNAL}>
            <Icon aria-hidden />
          </a>
        );
      })}
    </nav>
  );
}

/** Renders one validated block. There is no raw HTML: everything goes through React's escaping. */
export function BlockView({ block, context }: { block: RenderableBlock; context: RenderContext }) {
  const { buttonStyle, showIcons } = context;

  switch (block.type) {
    case "link": {
      const { title, url, description, thumbnailPath, icon, variant } = block.config;
      const Icon = icon ? LINK_ICONS[icon] : null;
      return (
        <Button
          href={url}
          style={variant && variant !== "theme" ? variant : buttonStyle}
          thumbnail={publicMediaUrl(thumbnailPath)}
          icon={showIcons && Icon ? <Icon className="fm-button-icon" aria-hidden /> : undefined}
          description={description}
        >
          {title}
        </Button>
      );
    }
    case "featured_link": {
      const { title, url, description, thumbnailPath } = block.config;
      const image = publicMediaUrl(thumbnailPath);
      return (
        <a href={url} className="fm-card" {...EXTERNAL}>
          {image ? (
            <span className="fm-card-media" style={{ display: "block" }}>
              <Image src={image} alt="" fill sizes="(max-width: 640px) 100vw, 36rem" style={{ objectFit: "cover" }} />
            </span>
          ) : null}
          <span className="fm-card-body">
            <span className="fm-card-title">{title}</span>
            {description ? <span className="fm-card-text">{description}</span> : null}
          </span>
        </a>
      );
    }
    case "product_card": {
      const { title, url, description, price, imagePath } = block.config;
      const image = publicMediaUrl(imagePath);
      return (
        <a href={url} className="fm-card" {...EXTERNAL}>
          {image ? (
            <span className="fm-card-media" style={{ display: "block" }}>
              <Image src={image} alt="" fill sizes="(max-width: 640px) 100vw, 36rem" style={{ objectFit: "cover" }} />
            </span>
          ) : null}
          <span className="fm-card-body">
            <span className="fm-card-title">{title}</span>
            {description ? <span className="fm-card-text">{description}</span> : null}
            {price ? <span className="fm-price">{price}</span> : null}
          </span>
        </a>
      );
    }
    case "social_icons":
      return <SocialIcons links={context.socialLinks} />;
    case "heading":
      return <h2 className="fm-heading">{block.config.text}</h2>;
    case "text":
      return <p className="fm-text">{block.config.text}</p>;
    case "divider":
      return <hr className="fm-divider" />;
    case "image": {
      const { path, alt, linkUrl } = block.config;
      const src = publicMediaUrl(path);
      if (!src) return null;
      const image = <Image src={src} alt={alt ?? ""} fill sizes="(max-width: 640px) 100vw, 36rem" style={{ objectFit: "cover" }} loading="lazy" />;
      return linkUrl ? (
        <a href={linkUrl} className="fm-image" {...EXTERNAL}>{image}</a>
      ) : (
        <div className="fm-image">{image}</div>
      );
    }
    case "youtube": {
      const embed = parseYouTube(block.config.url);
      return embed ? <VideoPlayer embed={embed} /> : null;
    }
    case "video": {
      const embed = parseVideo(block.config.url);
      return embed ? <VideoPlayer embed={embed} /> : null;
    }
    case "spotify": {
      const embed = parseSpotify(block.config.url);
      return embed ? <AudioPlayer embed={embed} /> : null;
    }
    case "soundcloud": {
      const embed = parseSoundCloud(block.config.url);
      return embed ? <AudioPlayer embed={embed} /> : null;
    }
    case "contact_info": {
      const { email, phone, address } = block.config;
      return (
        <div className="fm-card">
          <div className="fm-card-body fm-contact-list">
            {email ? <a href={`mailto:${email}`} className="fm-contact-row"><Mail aria-hidden />{email}</a> : null}
            {phone ? <a href={`tel:${phone}`} className="fm-contact-row"><Phone aria-hidden />{phone}</a> : null}
            {address ? <p className="fm-contact-row"><MapPin aria-hidden />{address}</p> : null}
          </div>
        </div>
      );
    }
    case "email_button":
      return (
        <Button href={`mailto:${block.config.email}`} external={false} style={buttonStyle} icon={showIcons ? <Mail className="fm-button-icon" aria-hidden /> : undefined}>
          {block.config.label}
        </Button>
      );
    case "phone_button":
      return (
        <Button href={`tel:${block.config.phone}`} external={false} style={buttonStyle} icon={showIcons ? <Phone className="fm-button-icon" aria-hidden /> : undefined}>
          {block.config.label}
        </Button>
      );
    case "announcement":
      return block.config.url ? (
        <a href={block.config.url} className="fm-announcement" {...EXTERNAL}>{block.config.text}</a>
      ) : (
        <p className="fm-announcement">{block.config.text}</p>
      );
    case "newsletter":
      return (
        <div className="fm-card">
          <div className="fm-card-body">
            <h2 className="fm-card-title">{block.config.heading}</h2>
            {block.config.description ? <p className="fm-card-text">{block.config.description}</p> : null}
            <NewsletterForm blockId={block.id} ownerName={context.ownerName} buttonLabel={block.config.buttonLabel} preview={context.preview} />
          </div>
        </div>
      );
    case "contact_form":
      return (
        <div className="fm-card">
          <div className="fm-card-body">
            <h2 className="fm-card-title">{block.config.heading}</h2>
            <ContactForm blockId={block.id} ownerName={context.ownerName} buttonLabel={block.config.buttonLabel} preview={context.preview} />
          </div>
        </div>
      );
  }
}
