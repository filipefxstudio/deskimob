"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TelefoneInput } from "@/components/ui/telefone-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PessoaDuplicidadeAviso } from "@/components/pessoas/PessoaAutocomplete";
import {
  descartarAtendimento,
  excluirAtendimento,
  transferirAtendimento,
  updateAtendimentoCadastro,
} from "@/lib/actions/atendimentos";
import { formatTelefoneBr } from "@/lib/imoveis/telefone";
import { isValidUuid } from "@/lib/utils/uuid";
import { toast } from "@/hooks/use-toast";
import type { MidiaOrigem, MotivoDescarte } from "@/types";

interface AtendimentoModalsProps {
  leadId: string;
  leadClienteId?: string | null;
  leadNome?: string | null;
  leadTelefone?: string | null;
  leadEmail?: string | null;
  leadMidiaNome?: string | null;
  leadPerfilId?: string | null;
  perfis: { id: string; nome: string }[];
  midias: MidiaOrigem[];
  motivos: MotivoDescarte[];
  podeTransferir: boolean;
  podeExcluir?: boolean;
  editarOpen?: boolean;
  descartarOpen: boolean;
  transferirOpen: boolean;
  excluirOpen?: boolean;
  onEditarOpenChange?: (open: boolean) => void;
  onDescartarOpenChange: (open: boolean) => void;
  onTransferirOpenChange: (open: boolean) => void;
  onExcluirOpenChange?: (open: boolean) => void;
}

export function AtendimentoModals({
  leadId,
  leadClienteId,
  leadNome,
  leadTelefone,
  leadEmail,
  leadMidiaNome,
  leadPerfilId,
  perfis,
  midias,
  motivos,
  podeTransferir,
  podeExcluir,
  editarOpen = false,
  descartarOpen,
  transferirOpen,
  excluirOpen = false,
  onEditarOpenChange,
  onDescartarOpenChange,
  onTransferirOpenChange,
  onExcluirOpenChange,
}: AtendimentoModalsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [motivoId, setMotivoId] = useState("");
  const [obsDescarte, setObsDescarte] = useState("");
  const [perfilDestino, setPerfilDestino] = useState("");
  const [motivoExclusao, setMotivoExclusao] = useState("");
  const [nome, setNome] = useState(leadNome ?? "");
  const [telefone, setTelefone] = useState(leadTelefone ?? "");
  const [email, setEmail] = useState(leadEmail ?? "");
  const [midiaNome, setMidiaNome] = useState(leadMidiaNome ?? "");
  const [perfilId, setPerfilId] = useState(leadPerfilId ?? "");
  const [duplicidadeAtiva, setDuplicidadeAtiva] = useState(false);

  const midiasAtivas = useMemo(() => midias.filter((m) => m.ativo), [midias]);

  useEffect(() => {
    if (editarOpen) {
      setNome(leadNome ?? "");
      setTelefone(leadTelefone ? formatTelefoneBr(leadTelefone) : "");
      setEmail(leadEmail ?? "");
      setMidiaNome(leadMidiaNome ?? "");
      setPerfilId(leadPerfilId ?? "");
      setDuplicidadeAtiva(false);
    }
  }, [editarOpen, leadNome, leadTelefone, leadEmail, leadMidiaNome, leadPerfilId]);

  function handleDescartar() {
    if (!isValidUuid(motivoId)) {
      toast({ variant: "destructive", title: "Selecione um motivo." });
      return;
    }
    if (!obsDescarte.trim()) {
      toast({ variant: "destructive", title: "Informe informações adicionais." });
      return;
    }
    startTransition(async () => {
      const result = await descartarAtendimento(leadId, motivoId, obsDescarte);
      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        return;
      }
      toast({ title: result.message });
      onDescartarOpenChange(false);
      router.refresh();
    });
  }

  function handleTransferir() {
    if (!perfilDestino) {
      toast({ variant: "destructive", title: "Selecione o responsável." });
      return;
    }
    startTransition(async () => {
      const result = await transferirAtendimento(leadId, perfilDestino);
      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        return;
      }
      toast({ title: result.message });
      onTransferirOpenChange(false);
      router.refresh();
    });
  }

  function handleEditar() {
    if (!nome.trim()) {
      toast({ variant: "destructive", title: "Informe o nome." });
      return;
    }
    if (!telefone.trim()) {
      toast({ variant: "destructive", title: "Informe o telefone." });
      return;
    }
    if (!midiaNome.trim()) {
      toast({ variant: "destructive", title: "Selecione a mídia de origem." });
      return;
    }

    startTransition(async () => {
      const result = await updateAtendimentoCadastro(leadId, {
        nome,
        telefone,
        email: email || undefined,
        midia_nome: midiaNome,
        perfil_id: perfilId || null,
      });
      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        return;
      }
      toast({ title: result.message });
      onEditarOpenChange?.(false);
      router.refresh();
    });
  }

  function handleExcluir() {
    if (!motivoExclusao.trim()) {
      toast({ variant: "destructive", title: "Informe o motivo da exclusão." });
      return;
    }
    startTransition(async () => {
      const result = await excluirAtendimento(leadId, motivoExclusao);
      if (result.error) {
        toast({ variant: "destructive", title: "Erro", description: result.error });
        return;
      }
      toast({ title: result.message });
      onExcluirOpenChange?.(false);
      router.push("/dashboard/atendimentos");
      router.refresh();
    });
  }

  return (
    <>
      <Dialog open={editarOpen} onOpenChange={(open) => onEditarOpenChange?.(open)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar cadastro</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="editar-nome">Nome *</Label>
              <Input
                id="editar-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editar-telefone">Telefone *</Label>
              <TelefoneInput
                id="editar-telefone"
                value={telefone}
                onChange={setTelefone}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editar-email">E-mail</Label>
              <Input
                id="editar-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Mídia de origem *</Label>
              <Select value={midiaNome} onValueChange={setMidiaNome}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {midiasAtivas.map((m) => (
                    <SelectItem key={m.id} value={m.nome}>
                      {m.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {perfis.length > 0 ? (
              <div className="space-y-2">
                <Label>Corretor responsável</Label>
                <Select value={perfilId} onValueChange={setPerfilId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {perfis.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <PessoaDuplicidadeAviso
              telefone={telefone}
              email={email}
              clienteIdIgnorar={leadClienteId ?? undefined}
              leadIdIgnorar={leadId}
              originalTelefone={leadTelefone ?? ""}
              originalEmail={leadEmail ?? ""}
              onDuplicidadeChange={(duplicado) => setDuplicidadeAtiva(duplicado)}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={isPending}
                onClick={() => onEditarOpenChange?.(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={isPending || duplicidadeAtiva}
                onClick={handleEditar}
              >
                {isPending ? <Loader2 className="size-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={descartarOpen} onOpenChange={onDescartarOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar atendimento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {leadNome ? `Descartar ${leadNome}?` : "Este atendimento será marcado como descartado."}
          </p>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Select value={motivoId} onValueChange={setMotivoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {motivos.filter((m) => m.ativo).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Informações adicionais *</Label>
              <Textarea
                value={obsDescarte}
                onChange={(e) => setObsDescarte(e.target.value)}
                rows={2}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={isPending}
                onClick={() => onDescartarOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={isPending}
                onClick={handleDescartar}
              >
                {isPending ? <Loader2 className="size-4 animate-spin" /> : "Confirmar descarte"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={transferirOpen} onOpenChange={onTransferirOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir atendimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Novo responsável</Label>
              <Select value={perfilDestino} onValueChange={setPerfilDestino}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {perfis.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={isPending} onClick={handleTransferir}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : "Transferir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {podeExcluir ? (
        <Dialog open={excluirOpen} onOpenChange={(open) => onExcluirOpenChange?.(open)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir atendimento</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {leadNome
                ? `Excluir permanentemente o atendimento de ${leadNome}?`
                : "Esta ação não pode ser desfeita."}
            </p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Motivo *</Label>
                <Textarea
                  value={motivoExclusao}
                  onChange={(e) => setMotivoExclusao(e.target.value)}
                  rows={3}
                  required
                />
              </div>
              <Button
                variant="destructive"
                className="w-full"
                disabled={isPending}
                onClick={handleExcluir}
              >
                {isPending ? <Loader2 className="size-4 animate-spin" /> : "Confirmar exclusão"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
