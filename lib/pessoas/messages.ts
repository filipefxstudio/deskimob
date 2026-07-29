export function mensagemDuplicidadeTelefone(nome: string): string {
  return `Já existe um cadastro com este telefone: ${nome}. Selecione o cadastro existente.`;
}

export function mensagemDuplicidadeEmail(nome: string): string {
  return `Já existe um cadastro com este e-mail: ${nome}. Selecione o cadastro existente.`;
}

export function mensagemLeadAtivoOutroCorretor(nomeCorretor: string): string {
  return `Esta pessoa já está em atendimento ativo com ${nomeCorretor}. Solicite a transferência ao gerente.`;
}

export function mensagemLeadAtivoMesmoCorretor(): string {
  return "Esta pessoa já tem um atendimento ativo. Acesse o atendimento existente em vez de criar um novo.";
}

export function mensagemAtendimentoEmAndamento(): string {
  return "Pessoa já cadastrada no sistema com atendimento em andamento.";
}

export function mensagemSelecionarCadastroExistente(): string {
  return "Já existe um cadastro com este contato. Selecione o cadastro existente na lista.";
}

export type ImovelDuplicidadeMotivo =
  | "mesmo_complemento"
  | "complemento_vazio_existente_com_complemento"
  | "complemento_preenchido_existente_sem_complemento";

export function mensagemImovelDuplicado(codigo: string, _bairro?: string): string {
  return `Já existe o imóvel #${codigo} cadastrado neste endereço. Verifique antes de continuar.`;
}

export function mensagemImovelDuplicadoPorMotivo(
  motivo: ImovelDuplicidadeMotivo,
  codigo: string,
): string {
  switch (motivo) {
    case "complemento_vazio_existente_com_complemento":
      return `Já existe o imóvel #${codigo} neste endereço com complemento cadastrado. Informe o complemento/identificação da unidade.`;
    case "complemento_preenchido_existente_sem_complemento":
      return `Já existe o imóvel #${codigo} neste endereço sem complemento. Não é possível cadastrar outra unidade com complemento no mesmo endereço.`;
    case "mesmo_complemento":
    default:
      return mensagemImovelDuplicado(codigo);
  }
}

export function mensagemProprietarioIndisponivel(): string {
  return "Esta pessoa já está cadastrada por outro corretor e não está disponível para vinculação.";
}

export function mensagemPessoaDescartada(): string {
  return "Esta pessoa foi descartada anteriormente. Preencha as novas informações de interesse e confirme o novo atendimento.";
}

export function erroDuplicidadePessoa(
  motivo: "telefone" | "email",
  nome: string,
): string {
  return motivo === "telefone"
    ? mensagemDuplicidadeTelefone(nome)
    : mensagemDuplicidadeEmail(nome);
}
