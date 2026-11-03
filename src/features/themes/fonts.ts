import { DM_Serif_Display, Geist, Geist_Mono, Inter, Lora, Playfair_Display, Poppins, Space_Grotesk } from "next/font/google";

// preload is off: a page downloads only the fonts its theme actually uses.
const geist = Geist({ subsets: ["latin"], variable: "--fm-font-geist", preload: false });
const inter = Inter({ subsets: ["latin"], variable: "--fm-font-inter", preload: false });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--fm-font-poppins", preload: false });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--fm-font-space-grotesk", preload: false });
const lora = Lora({ subsets: ["latin"], variable: "--fm-font-lora", preload: false });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--fm-font-playfair", preload: false });
const dmSerif = DM_Serif_Display({ subsets: ["latin"], weight: "400", variable: "--fm-font-dm-serif", preload: false });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--fm-font-mono", preload: false });

export const THEME_FONT_CLASSES = [geist, inter, poppins, spaceGrotesk, lora, playfair, dmSerif, mono]
  .map((font) => font.variable)
  .join(" ");

export const FONT_LABELS = {
  geist: "Geist",
  inter: "Inter",
  poppins: "Poppins",
  space_grotesk: "Space Grotesk",
  lora: "Lora",
  playfair: "Playfair Display",
  dm_serif: "DM Serif Display",
  mono: "Geist Mono",
} as const;
