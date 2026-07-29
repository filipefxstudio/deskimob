import type { Imovel } from "@/types";

import {
  IconAreaTotal,
  IconAreaUtil,
  IconBanheiro,
  IconQuartos,
  IconSuite,
  IconVagas,
} from "@/components/icons/ImovelStatIcons";
import { ImovelStatItem, ImovelStatsRow } from "@/components/imoveis/ImovelStatsRow";

type ImovelStatsVariant = "card" | "detail";

interface ImovelStatsProps {
  imovel: Imovel;
  variant?: ImovelStatsVariant;
  /** Exibe área total (somente em detalhes). */
  showAreaTotal?: boolean;
  iconClassName?: string;
  className?: string;
}

export function ImovelStats({
  imovel,
  variant = "card",
  showAreaTotal = false,
  iconClassName = "text-primary",
  className,
}: ImovelStatsProps) {
  const iconSize = variant;

  return (
    <ImovelStatsRow variant={variant} className={className}>
      {imovel.area_util ? (
        <ImovelStatItem
          variant={variant}
          icon={<IconAreaUtil size={iconSize} className={iconClassName} />}
        >
          {imovel.area_util} m²
        </ImovelStatItem>
      ) : null}
      {imovel.quartos > 0 ? (
        <ImovelStatItem
          variant={variant}
          icon={<IconQuartos size={iconSize} className={iconClassName} />}
        >
          {imovel.quartos}
        </ImovelStatItem>
      ) : null}
      {imovel.suites > 0 ? (
        <ImovelStatItem
          variant={variant}
          icon={<IconSuite size={iconSize} className={iconClassName} />}
        >
          {imovel.suites}
        </ImovelStatItem>
      ) : null}
      {imovel.banheiros > 0 ? (
        <ImovelStatItem
          variant={variant}
          icon={<IconBanheiro size={iconSize} className={iconClassName} />}
        >
          {imovel.banheiros}
        </ImovelStatItem>
      ) : null}
      {imovel.vagas > 0 ? (
        <ImovelStatItem
          variant={variant}
          icon={<IconVagas size={iconSize} className={iconClassName} />}
        >
          {imovel.vagas}
        </ImovelStatItem>
      ) : null}
      {showAreaTotal && imovel.area_total ? (
        <ImovelStatItem
          variant={variant}
          icon={<IconAreaTotal size={iconSize} className={iconClassName} />}
        >
          {imovel.area_total} m² total
        </ImovelStatItem>
      ) : null}
    </ImovelStatsRow>
  );
}
