import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/** Banheira com chuveiro — representa suítes. */
export function IconSuite(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 15h10.5" />
      <path d="M3 15c0 0 0 3.75 5.25 3.75S13.5 18.75 13.5 15" />
      <path d="M5.5 18.75v1.5" />
      <path d="M10 18.75v1.5" />
      <path d="M5 16.25c1.25.75 2.75.75 4 0" />
      <path d="M13.5 15V8.25" />
      <path d="M13.5 8.25H9.75" />
      <path d="M9.75 8.25v1.1c0 .55.45 1 1 1h.75" />
      <path d="M9 11.5l-.55 1.1" />
      <path d="M10.15 11.5l-.55 1.1" />
      <path d="M11.3 11.5l-.55 1.1" />
    </svg>
  );
}

/** Chuveiro — representa banheiros. */
export function IconBanheiro(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M17.5 3v7.75" />
      <path d="M17.5 10.75H11.75" />
      <path d="M11.75 10.75v1.25" />
      <path d="M10 12h3.5l-1.75 3.75H8.25L10 12z" />
      <path d="M8.35 16.5l-.9 1.6" />
      <path d="M9.55 16.5l-.9 1.6" />
      <path d="M10.75 16.5l-.9 1.6" />
      <path d="M11.95 16.5l-.9 1.6" />
    </svg>
  );
}
