import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

type ImovelStatIconProps = SVGProps<SVGSVGElement> & {
  /** `card` para listagens; `detail` para páginas de detalhe. */
  size?: "card" | "detail";
};

const sizeClass = {
  card: "size-4",
  detail: "size-4",
} as const;

type IconConfig = {
  path: string;
  /** Ajuste fino para equalizar peso visual entre glifos diferentes. */
  scale?: number;
};

/** Paths oficiais do Material Symbols Outlined (Google Fonts Icons). */
const ICONS = {
  king_bed: {
    path: "M176-200h-30.3L126-280H80v-214q0-25.9 17-43.95Q114-556 140-556h26v-144q0-24.75 17.63-42.38Q201.25-760 226-760h507q24.75 0 42.38 17.62Q793-724.75 793-700v144h27q24.75 0 42.38 17.62Q880-520.75 880-496v216h-46l-19.78 80h-30.44L764-280H197l-21 80Zm334-356h223v-144H510v144Zm-284 0h224v-144H226v144Zm-86 216h680v-156H140v156Zm680 0H140h680Z",
  },
  bathtub: {
    path: "M221.5-620.42q-21.5-21.42-21.5-51.5t21.42-51.58q21.42-21.5 51.5-21.5t51.58 21.42q21.5 21.42 21.5 51.5t-21.42 51.58q-21.42 21.5-51.5 21.5t-51.58-21.42ZM185.82-80Q168-80 154-91.5T140-120q-24.75 0-42.37-17.63Q80-155.25 80-180v-260h120v-27.79Q200-503 225-528t60.38-25q18.62 0 35.62 7 17 7 30 21l52 59q7 8 14.5 14.5T433-440h307v-334q0-18.94-12.5-32.47Q715-820 696-820q-9.88 0-18.94 2T661-809l-52 52q5 17 1.5 34.5T598-689l-102-97q16.43-10.93 35.22-13.96Q550-803 568-796l52-51q15-15 34.54-24t41.46-9q43.79 0 73.89 31Q800-818 800-774v334h80v260q0 24.75-17.62 42.37Q844.75-120 820-120q0 17-14 28.5T773-80H185.82ZM140-180h680v-200H140v200Zm0 0h680-680Z",
    scale: 0.9,
  },
  shower: {
    path: "M298-263q-12 0-21-9t-9-21q0-12 9-21t21-9q12 0 21 9t9 21q0 12-9 21t-21 9Zm182 0q-12 0-21-9t-9-21q0-12 9-21t21-9q12 0 21 9t9 21q0 12-9 21t-21 9Zm182 0q-12 0-21-9t-9-21q0-12 9-21t21-9q12 0 21 9t9 21q0 12-9 21t-21 9ZM200-413v-60q0-107 72.5-187T450-751v-89h60v89q105 11 177.5 91T760-473v60H200Zm60-60h440q0-91-64.29-155.5T480.21-693Q389-693 324.5-628.65 260-564.3 260-473Zm38 353q-12 0-21-9t-9-21q0-12 9-21t21-9q12 0 21 9t9 21q0 12-9 21t-21 9Zm182 0q-12 0-21-9t-9-21q0-12 9-21t21-9q12 0 21 9t9 21q0 12-9 21t-21 9Zm182 0q-12 0-21-9t-9-21q0-12 9-21t21-9q12 0 21 9t9 21q0 12-9 21t-21 9ZM480-473Z",
    scale: 0.92,
  },
  directions_car: {
    path: "M200-204v54q0 12.75-8.62 21.37Q182.75-120 170-120h-20q-12.75 0-21.37-8.63Q120-137.25 120-150v-324l85-256q5-14 16.5-22t26.5-8h464q15 0 26.5 8t16.5 22l85 256v324q0 12.75-8.62 21.37Q822.75-120 810-120h-21q-13 0-21-8.63-8-8.62-8-21.37v-54H200Zm3-330h554l-55-166H258l-55 166Zm-23 60v210-210Zm105.76 160q23.24 0 38.74-15.75Q340-345.5 340-368q0-23.33-15.75-39.67Q308.5-424 286-424q-23.33 0-39.67 16.26Q230-391.47 230-368.24q0 23.24 16.26 38.74 16.27 15.5 39.5 15.5ZM675-314q23.33 0 39.67-15.75Q731-345.5 731-368q0-23.33-16.26-39.67Q698.47-424 675.24-424q-23.24 0-38.74 16.26-15.5 16.27-15.5 39.5 0 23.24 15.75 38.74Q652.5-314 675-314Zm-495 50h600v-210H180v210Z",
  },
  straighten: {
    path: "M140-240q-24 0-42-18t-18-42v-360q0-23 18-41.5t42-18.5h680q24 0 42 18.5t18 41.5v360q0 24-18 42t-42 18H140Zm0-60h680v-360H690v180h-60v-180H510v180h-60v-180H330v180h-60v-180H140v360Zm130-180h60-60Zm180 0h60-60Zm180 0h60-60Zm-150 0Z",
    scale: 0.94,
  },
  open_in_full: {
    path: "M120-120v-300h60v198l558-558H540v-60h300v300h-60v-198L222-180h198v60H120Z",
    scale: 0.9,
  },
} satisfies Record<string, IconConfig>;

function MaterialStatIcon({
  icon,
  className,
  size = "card",
  ...props
}: ImovelStatIconProps & { icon: IconConfig }) {
  const scale = icon.scale ?? 1;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        sizeClass[size],
        className,
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 -960 960 960"
        fill="currentColor"
        className="size-full"
        style={scale === 1 ? undefined : { transform: `scale(${scale})` }}
        {...props}
      >
        <path d={icon.path} />
      </svg>
    </span>
  );
}

/** King bed — quartos. */
export function IconQuartos(props: ImovelStatIconProps) {
  return <MaterialStatIcon icon={ICONS.king_bed} {...props} />;
}

/** Bathtub — suítes. */
export function IconSuite(props: ImovelStatIconProps) {
  return <MaterialStatIcon icon={ICONS.bathtub} {...props} />;
}

/** Shower — banheiros. */
export function IconBanheiro(props: ImovelStatIconProps) {
  return <MaterialStatIcon icon={ICONS.shower} {...props} />;
}

/** Directions car — vagas. */
export function IconVagas(props: ImovelStatIconProps) {
  return <MaterialStatIcon icon={ICONS.directions_car} {...props} />;
}

/** Straighten — área útil. */
export function IconAreaUtil(props: ImovelStatIconProps) {
  return <MaterialStatIcon icon={ICONS.straighten} {...props} />;
}

/** Open in full — área total (somente detalhes). */
export function IconAreaTotal(props: ImovelStatIconProps) {
  return <MaterialStatIcon icon={ICONS.open_in_full} {...props} />;
}
