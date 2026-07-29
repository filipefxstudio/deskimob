import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/** Banheira — representa suítes nos cards. */
export function IconSuite(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 14h16v2.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5V14z" />
      <path d="M6 14V9a2 2 0 0 1 2-2h1.5" />
      <path d="M18 14V9a2 2 0 0 0-2-2h-1" />
      <path d="M8 7c0-1.5 1.2-2.5 2.5-2.5" />
      <path d="M3 17.5c1 .8 2.2 1.2 3.5 1.2" />
      <path d="M21 17.5c-1 .8-2.2 1.2-3.5 1.2" />
      <path d="M10 9.5c.5-.5 1.2-.8 2-.8s1.5.3 2 .8" />
    </svg>
  );
}

/** Chuveiro — representa banheiros nos cards. */
export function IconBanheiro(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M8 4h8v3a4 4 0 0 1-4 4 4 4 0 0 1-4-4V4z" />
      <path d="M12 11v2" />
      <path d="M9.5 13.5c-2 1.5-3 3.5-3 6" />
      <path d="M14.5 13.5c2 1.5 3 3.5 3 6" />
      <path d="M10 19.5h4" />
      <path d="M11 21.5h2" />
      <path d="M10.5 16.5h.01M13.5 16.5h.01M10.5 18.5h.01M13.5 18.5h.01" />
    </svg>
  );
}
