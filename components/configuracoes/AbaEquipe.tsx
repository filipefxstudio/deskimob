"use client";

import { Loader2, MoreVertical, UserPlus } from "lucide-react";

import { PasswordInput } from "@/components/auth/password-input";
import { ActionMenuIcon } from "@/components/ui/action-menu-item";
import { ACTION_MENU_DESTRUCTIVE_CLASS } from "@/lib/ui/action-menu-icons";
import { cn } from "@/lib/utils";
import { useRef, useState, useTransition, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  convidarPerfil,
  editarPerfil,
  excluirPerfil,
  togglePerfilAtivo,
} from "@/lib/actions/configuracoes";
import { PAPEL_DESCRICOES, PAPEL_LABELS } from "@/lib/auth/equipe-labels";
import {
  isPerfilConvitePendente,
  isPrincipalPerfil,
  type CorretorRef,
} from "@/lib/auth/equipe-perfil";
import { EQUIPE_LIMITE_USUARIOS } from "@/lib/constants/imoveis";
import type { PapelUsuario, Perfil } from "@/types";

interface AbaEquipeProps {
  perfis: Perfil[];
  corretor: CorretorRef;
  isAdmin?: boolean;
}

const papelLabels = PAPEL_LABELS;

export function AbaEquipe({ perfis: initialPerfis, corretor, isAdmin = false }: AbaEquipeProps) {
  const [perfis, setPerfis] = useState(initialPerfis);
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [papel, setPapel] = useState<PapelUsuario>("corretor");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Perfil | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPapel, setEditPapel] = useState<PapelUsuario>("corretor");
  const [editSenhaInicial, setEditSenhaInicial] = useState("");
  const [editConfirmarSenha, setEditConfirmarSenha] = useState("");

  function isPrincipal(perfil: Perfil) {
    return isPrincipalPerfil(perfil, corretor);
  }

  function isConvitePendente(perfil: Perfil) {
    return isPerfilConvitePendente(perfil, corretor);
  }

  function handleConvidar(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);
    setError(null);

    startTransition(async () => {
      const result = await convidarPerfil({ nome, email, telefone, papel });

      if (result.error) {
        setError(result.error);
        return;
      }

      setFeedback(result.message ?? "Convite enviado.");
      setShowForm(false);
      setNome("");
      setEmail("");
      setTelefone("");
      setPapel("corretor");
    });
  }

  function handleToggle(id: string, ativo: boolean) {
    startTransition(async () => {
      const result = await togglePerfilAtivo(id, ativo);
      if (result.error) {
        setError(result.error);
        return;
      }
      setPerfis((prev) =>
        prev.map((perfil) => (perfil.id === id ? { ...perfil, ativo } : perfil)),
      );
    });
  }

  function openEdit(perfil: Perfil) {
    setSelected(perfil);
    setEditNome(perfil.nome);
    setEditEmail(perfil.email);
    setEditPapel(isPrincipal(perfil) ? "admin" : perfil.papel);
    setEditSenhaInicial("");
    setEditConfirmarSenha("");
    setEditOpen(true);
  }

  function openDelete(perfil: Perfil) {
    setSelected(perfil);
    setDeleteOpen(true);
  }

  function handleEdit() {
    if (!selected) return;
    startTransition(async () => {
      const result = await editarPerfil(selected.id, {
        nome: editNome,
        email: editEmail,
        papel: editPapel,
        senhaInicial: editSenhaInicial || undefined,
        confirmarSenhaInicial: editConfirmarSenha || undefined,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setPerfis((prev) =>
        prev.map((p) =>
          p.id === selected.id
            ? { ...p, nome: editNome, email: editEmail, papel: editPapel }
            : p,
        ),
      );
      setEditOpen(false);
      setEditSenhaInicial("");
      setEditConfirmarSenha("");
      setFeedback(result.message ?? "Perfil atualizado.");
    });
  }

  function handleDelete() {
    if (!selected) return;
    startTransition(async () => {
      const result = await excluirPerfil(selected.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setPerfis((prev) => prev.filter((p) => p.id !== selected.id));
      setDeleteOpen(false);
      setFeedback(result.message ?? "Perfil excluído.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Equipe</CardTitle>
        <CardDescription>
          Até {EQUIPE_LIMITE_USUARIOS} usuários com acesso ao painel. Apenas administradores
          podem convidar membros, alterar papéis, o e-mail de login e definir senha inicial.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y rounded-lg border">
          {perfis.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum membro da equipe cadastrado.
            </li>
          ) : (
            perfis.map((perfil) => (
              <li
                key={perfil.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {perfil.nome}
                    {isPrincipal(perfil) ? (
                      <span className="ml-2 text-xs text-muted-foreground">(principal)</span>
                    ) : null}
                  </p>
                  <p className="text-sm text-muted-foreground">{perfil.email}</p>
                  {isConvitePendente(perfil) ? (
                    <p className="text-xs text-amber-600">Convite pendente — aguardando primeiro acesso</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {papelLabels[isPrincipal(perfil) ? "admin" : perfil.papel]}
                  </span>
                  {!perfil.ativo && !isPrincipal(perfil) ? (
                    <span className="text-xs text-muted-foreground">Inativo</span>
                  ) : null}
                  {!isPrincipal(perfil) ? (
                    <Switch
                      checked={perfil.ativo}
                      onCheckedChange={(checked) => handleToggle(perfil.id, checked)}
                      disabled={isPending}
                    />
                  ) : null}
                  <EquipeAcoesMenu
                    perfil={perfil}
                    isPrincipal={isPrincipal(perfil)}
                    onEdit={() => openEdit(perfil)}
                    onDelete={() => openDelete(perfil)}
                  />
                </div>
              </li>
            ))
          )}
        </ul>

        {showForm ? (
          <form onSubmit={handleConvidar} className="space-y-4 rounded-lg border p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="equipe_nome">Nome</Label>
                <Input
                  id="equipe_nome"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="equipe_email">E-mail</Label>
                <Input
                  id="equipe_email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="equipe_telefone">Telefone</Label>
                <Input
                  id="equipe_telefone"
                  value={telefone}
                  onChange={(event) => setTelefone(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Papel e permissões</Label>
                <Select value={papel} onValueChange={(v) => setPapel(v as PapelUsuario)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="gerente">Gerente/Diretor</SelectItem>
                    <SelectItem value="corretor">Corretor</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{PAPEL_DESCRICOES[papel]}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="animate-spin" /> : "Enviar convite"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowForm(true)}
            disabled={perfis.length >= EQUIPE_LIMITE_USUARIOS}
          >
            <UserPlus className="size-4" data-icon="inline-start" />
            Convidar
          </Button>
        )}

        {feedback ? <p className="text-sm text-green-600">{feedback}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar membro</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>E-mail de login</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                {selected && isConvitePendente(selected)
                  ? "Convite ainda não ativado: altera o e-mail do convite. O login será criado no primeiro acesso."
                  : "Altera o e-mail usado para entrar no painel (auth) e mantém o perfil sincronizado."}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Papel e permissões</Label>
              <Select
                value={editPapel}
                onValueChange={(v) => setEditPapel(v as PapelUsuario)}
                disabled={selected ? isPrincipal(selected) : false}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="gerente">Gerente/Diretor</SelectItem>
                  <SelectItem value="corretor">Corretor</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{PAPEL_DESCRICOES[editPapel]}</p>
              {selected && isPrincipal(selected) ? (
                <p className="text-xs text-muted-foreground">
                  O administrador principal permanece com papel Administrador.
                </p>
              ) : null}
            </div>
            {isAdmin ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit_senha_inicial">Senha inicial</Label>
                  <PasswordInput
                    id="edit_senha_inicial"
                    value={editSenhaInicial}
                    onChange={(event) => setEditSenhaInicial(event.target.value)}
                    autoComplete="new-password"
                    placeholder="Opcional — mínimo 6 caracteres"
                    minLength={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    {selected && isConvitePendente(selected)
                      ? "Define a senha para o primeiro acesso. Deixe em branco para manter a senha atual."
                      : "Define ou redefine a senha de login deste usuário. Deixe em branco para não alterar."}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_confirmar_senha">Confirmar senha inicial</Label>
                  <PasswordInput
                    id="edit_confirmar_senha"
                    value={editConfirmarSenha}
                    onChange={(event) => setEditConfirmarSenha(event.target.value)}
                    autoComplete="new-password"
                    placeholder="Repita a senha"
                    minLength={6}
                  />
                </div>
              </>
            ) : null}
            <Button className="w-full" disabled={isPending} onClick={handleEdit}>
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir membro</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Excluir {selected?.nome}? Esta ação não pode ser desfeita.
          </p>
          <Button variant="destructive" className="w-full" disabled={isPending} onClick={handleDelete}>
            Confirmar exclusão
          </Button>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function EquipeAcoesMenu({
  perfil,
  isPrincipal,
  onEdit,
  onDelete,
}: {
  perfil: Perfil;
  isPrincipal: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="rounded-lg border border-border p-1.5"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Ações de ${perfil.nome}`}
      >
        <MoreVertical className="size-4" />
      </button>
      {open ? (
        <div className="absolute right-0 z-10 mt-1 min-w-36 rounded-lg border bg-card py-1 shadow-lg">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            <ActionMenuIcon action="editar" />
            Editar
          </button>
          {!isPrincipal ? (
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                ACTION_MENU_DESTRUCTIVE_CLASS,
              )}
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              <ActionMenuIcon action="excluir" />
              Excluir
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
