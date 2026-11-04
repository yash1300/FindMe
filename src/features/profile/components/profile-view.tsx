import Image from "next/image";
import type { RenderableBlock } from "@/features/blocks/schema";
import { publicMediaUrl } from "@/features/media/paths";
import type { SocialPlatformId } from "@/features/social/platforms";
import { themeToStyle } from "@/features/themes/css";
import { THEME_FONT_CLASSES } from "@/features/themes/fonts";
import type { Theme } from "@/features/themes/schema";
import { getAppUrl } from "@/lib/env";
import { BlockView, SocialIcons, type RenderContext } from "./block-view";
import "../profile.css";

export type ProfileViewData = {
  username: string;
  displayName: string;
  bio: string | null;
  avatarPath: string | null;
  coverPath: string | null;
  theme: Theme;
  blocks: RenderableBlock[];
  socialLinks: { id: string; platform: SocialPlatformId; url: string }[];
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

/**
 * The one renderer behind public pages, the editor's live preview and the marketing demos.
 * It holds no state and fetches nothing, so it stays fast, and what a creator sees while
 * editing is exactly what visitors get.
 */
export function ProfileView({ data, preview = false }: { data: ProfileViewData; preview?: boolean }) {
  const { theme, blocks, socialLinks } = data;
  const avatar = publicMediaUrl(data.avatarPath);
  const cover = publicMediaUrl(data.coverPath);

  const context: RenderContext = {
    buttonStyle: theme.buttons.style,
    showIcons: theme.buttons.icons,
    ownerName: data.displayName,
    socialLinks,
    preview,
  };

  // If there's no social icons block, the icons sit under the bio so that they're never lost.
  const hasSocialBlock = blocks.some((block) => block.type === "social_icons");

  return (
    <div
      className={`fm-page ${THEME_FONT_CLASSES}`}
      style={themeToStyle(theme)}
      data-align={theme.layout.align}
      data-surface={theme.layout.surface}
      data-animation={theme.effects.animation}
      data-hover={theme.effects.hover}
      data-avatar-ring={theme.avatar.ring}
      data-has-cover={Boolean(cover) && theme.layout.surface === "none"}
      data-glass-buttons={theme.buttons.style === "glass"}
    >
      {cover ? (
        <div className="fm-cover">
          <Image src={cover} alt="" fill sizes="100vw" priority={!preview} style={{ objectFit: "cover" }} />
        </div>
      ) : null}
      <div className={`fm-container ${theme.layout.surface === "none" ? "" : `fm-surface-${theme.layout.surface}`}`}>
        <header className="fm-header fm-item" style={{ "--fm-i": 0 } as React.CSSProperties}>
          <div className="fm-avatar">
            {avatar ? (
              <Image src={avatar} alt="" fill sizes="136px" priority={!preview} style={{ objectFit: "cover" }} />
            ) : (
              <span aria-hidden>{initials(data.displayName)}</span>
            )}
          </div>
          <h1 className="fm-name">{data.displayName}</h1>
          <p className="fm-username">@{data.username}</p>
          {data.bio ? <p className="fm-bio">{data.bio}</p> : null}
          {!hasSocialBlock ? <SocialIcons links={socialLinks} /> : null}
        </header>

        {blocks.map((block, index) => (
          <div key={block.id} className="fm-item" style={{ "--fm-i": Math.min(index + 1, 12) } as React.CSSProperties}>
            <BlockView block={block} context={context} />
          </div>
        ))}

        <footer className="fm-footer">
          <a href={getAppUrl()} tabIndex={preview ? -1 : undefined}>Made with FindMe</a>
          {preview ? null : (
            <>
              {" · "}
              <a href={`${getAppUrl()}/report?u=${data.username}`} rel="nofollow">Report</a>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
