"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Mail, Phone, UserRound } from "lucide-react";
import Link from "next/link";

import { TipoClienteBadge } from "@/components/clientes/TipoClienteBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Cliente } from "@/types";

interface ClienteCardProps {
  cliente: Cliente;
}

export function ClienteCard({ cliente }: ClienteCardProps) {
  const responsavel = cliente.perfil?.nome ?? "—";
  const dataCadastro = format(new Date(cliente.criado_em), "dd/MM/yyyy", { locale: ptBR });
  const detalheHref = cliente.lead_id
    ? `/dashboard/atendimentos/${cliente.lead_id}`
    : `/dashboard/clientes/${cliente.id}`;
  const editarHref = cliente.lead_id
    ? `/dashboard/atendimentos/${cliente.lead_id}`
    : `/dashboard/clientes/${cliente.id}?editar=1`;

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserRound className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{cliente.nome}</p>
              <div className="mt-1 space-y-1 text-sm text-muted-foreground">
                <p className="flex items-center gap-1.5">
                  <Phone className="size-3.5 shrink-0" />
                  <span className="truncate">{cliente.telefone}</span>
                </p>
                {cliente.email ? (
                  <p className="flex items-center gap-1.5">
                    <Mail className="size-3.5 shrink-0" />
                    <span className="truncate">{cliente.email}</span>
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          <TipoClienteBadge tipo={cliente.tipo} />
        </div>

        <div className="mt-auto space-y-1 text-sm text-muted-foreground">
          <p>Responsável: {responsavel}</p>
          <p>Cadastrado em: {dataCadastro}</p>
          {cliente.eh_construtor_investidor ? (
            <p className="text-xs font-medium text-muted-foreground">Construtor / investidor</p>
          ) : null}
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href={detalheHref}>Ver</Link>
          </Button>
          <Button variant="secondary" size="sm" className="flex-1" asChild>
            <Link href={editarHref}>{cliente.lead_id ? "Atendimento" : "Editar"}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
