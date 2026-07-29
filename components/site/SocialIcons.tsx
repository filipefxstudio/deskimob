import type { SocialLink } from "@/lib/site/social";
import { cn } from "@/lib/utils";

function SocialIcon({ rede, className }: { rede: SocialLink["rede"]; className?: string }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true as const,
  };

  switch (rede) {
    case "instagram":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...props}>
          <rect x="3" y="6" width="18" height="12" rx="3" />
          <path d="M10 9.5v5l4.5-2.5L10 9.5z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...props}>
          <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
        </svg>
      );
    case "linkedin":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M8 11v6M8 8v.01M12 16v-3.5a2.5 2.5 0 0 1 5 0V16" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...props}>
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v9h4v-9h3l1-4h-4V7a1 1 0 0 1 1-1h3V2z" />
        </svg>
      );
  }
}

interface SocialIconsProps {
  links: SocialLink[];
  className?: string;
  iconClassName?: string;
}

export function SocialIcons({ links, className, iconClassName = "size-5" }: SocialIconsProps) {
  if (links.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {links.map((link) => (
        <a
          key={link.rede}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={link.label}
          className="inline-flex size-10 items-center justify-center rounded-full transition-opacity hover:opacity-70"
        >
          <SocialIcon rede={link.rede} className={iconClassName} />
        </a>
      ))}
    </div>
  );
}
