import type { ReactNode } from "react";
import type { Imovel } from "@/types";

import {
  IconAreaTotal,
  IconAreaUtil,
  IconBanheiro,
  IconQuartos,
  IconSuite,
  IconVagas,
} from "@/components/icons/ImovelStatIcons";
import { ImovelStatItem, ImovelStatsRow, type ImovelStatsVariant } from "@/components/imoveis/ImovelStatsRow";

interface ImovelStatsProps {
  imovel: Imovel;
  variant?: ImovelStatsVariant;
  /** Exibe área total (somente em detalhes). */
  showAreaTotal?: boolean;
  iconClassName?: string;
  className?: string;
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function ImovelStats({
  imovel,
  variant = "card",
  showAreaTotal = false,
  iconClassName = "text-primary",
  className,
}: ImovelStatsProps) {
  const iconSize = variant;
  const isProminent = variant === "detail-prominent";

  const stats = [
    showAreaTotal && imovel.area_total
      ? {
          key: "area_total",
          icon: <IconAreaTotal size={iconSize} className={iconClassName} />,
          label: isProminent
            ? `${imovel.area_total} m² tot.`
            : `${imovel.area_total} m² total`,
        }
      : null,
    imovel.area_util
      ? {
          key: "area_util",
          icon: <IconAreaUtil size={iconSize} className={iconClassName} />,
          label: isProminent ? `${imovel.area_util} m² útil` : `${imovel.area_util} m²`,
        }
      : null,
    imovel.banheiros > 0
      ? {
          key: "banheiros",
          icon: <IconBanheiro size={iconSize} className={iconClassName} />,
          label: isProminent
            ? `${imovel.banheiros} ${pluralize(imovel.banheiros, "banheiro", "banheiros")}`
            : String(imovel.banheiros),
        }
      : null,
    imovel.vagas > 0
      ? {
          key: "vagas",
          icon: <IconVagas size={iconSize} className={iconClassName} />,
          label: isProminent
            ? `${imovel.vagas} ${pluralize(imovel.vagas, "vaga", "vagas")}`
            : String(imovel.vagas),
        }
      : null,
    imovel.quartos > 0
      ? {
          key: "quartos",
          icon: <IconQuartos size={iconSize} className={iconClassName} />,
          label: isProminent
            ? `${imovel.quartos} ${pluralize(imovel.quartos, "quarto", "quartos")}`
            : String(imovel.quartos),
        }
      : null,
    imovel.suites > 0
      ? {
          key: "suites",
          icon: <IconSuite size={iconSize} className={iconClassName} />,
          label: isProminent
            ? `${imovel.suites} ${pluralize(imovel.suites, "suíte", "suítes")}`
            : String(imovel.suites),
        }
      : null,
  ].filter(Boolean) as { key: string; icon: ReactNode; label: string }[];

  return (
    <ImovelStatsRow variant={variant} className={className}>
      {stats.map((stat) => (
        <ImovelStatItem key={stat.key} variant={variant} icon={stat.icon}>
          {stat.label}
        </ImovelStatItem>
      ))}
    </ImovelStatsRow>
  );
}
