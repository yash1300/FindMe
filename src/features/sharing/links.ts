export type ShareTarget = { id: string; label: string; href: string };

/** Each destination gets the URL properly encoded, so a title can't alter the link. */
export function buildShareTargets(url: string, title: string): ShareTarget[] {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  return [
    { id: "whatsapp", label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}` },
    { id: "facebook", label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { id: "x", label: "X", href: `https://x.com/intent/post?url=${encodedUrl}&text=${encodedTitle}` },
    { id: "linkedin", label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}` },
    { id: "email", label: "Email", href: `mailto:?subject=${encodedTitle}&body=${encodedUrl}` },
  ];
}
