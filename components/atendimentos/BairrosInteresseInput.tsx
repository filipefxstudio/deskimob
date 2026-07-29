"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { getBairrosImoveisCadastrados } from "@/lib/actions/atendimentos";
import { contemNormalizado, normalizar } from "@/lib/utils/normalizar";

interface BairrosInteresseInputProps {
  value: string[];
  onChange: (bairros: string[]) => void;
  disabled?: boolean;
  /** Lista pré-carregada no servidor; evita fetch vazio no cliente. */
  options?: string[];
}

export function BairrosInteresseInput({
  value,
  onChange,
  disabled,
  options,
}: BairrosInteresseInputProps) {
  const [isLoading, setIsLoading] = useState(!options?.length);
  const [bairroInput, setBairroInput] = useState("");
  const [bairrosCadastrados, setBairrosCadastrados] = useState<string[]>(options ?? []);

  useEffect(() => {
    if (options?.length) {
      setBairrosCadastrados(options);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    getBairrosImoveisCadastrados()
      .then((bairros) => {
        if (!cancelled) {
          setBairrosCadastrados(bairros);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [options]);

  function bairroJaSelecionado(bairro: string): boolean {
    const alvo = normalizar(bairro);
    return value.some((item) => normalizar(item) === alvo);
  }

  const sugestoes = useMemo(() => {
    if (!bairroInput.trim()) return [];
    return bairrosCadastrados
      .filter((bairro) => !bairroJaSelecionado(bairro) && contemNormalizado(bairro, bairroInput))
      .slice(0, 8);
  }, [bairroInput, bairrosCadastrados, value]);

  function adicionarBairro(bairro: string) {
    const nome = bairro.trim();
    if (!nome || bairroJaSelecionado(nome)) return;
    onChange([...value, nome]);
    setBairroInput("");
  }

  function removerBairro(bairro: string) {
    onChange(value.filter((item) => item !== bairro));
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          value={bairroInput}
          onChange={(e) => setBairroInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (sugestoes[0]) adicionarBairro(sugestoes[0]);
              else adicionarBairro(bairroInput);
            }
          }}
          placeholder="Digite para buscar bairros cadastrados"
          disabled={disabled}
          autoComplete="off"
        />
        {isLoading ? (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
        {sugestoes.length > 0 ? (
          <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
            {sugestoes.map((bairro) => (
              <li key={bairro}>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => adicionarBairro(bairro)}
                >
                  {bairro}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((bairro) => (
            <span
              key={bairro}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs"
            >
              {bairro}
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-background"
                onClick={() => removerBairro(bairro)}
                disabled={disabled}
                aria-label={`Remover ${bairro}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
