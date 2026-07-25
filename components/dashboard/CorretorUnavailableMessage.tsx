export function CorretorUnavailableMessage() {
  return (
    <div className="flex-1 space-y-3 p-4 md:p-6">
      <h2 className="text-lg font-semibold text-primary">Conta indisponível</h2>
      <p className="text-sm text-muted-foreground">
        Não foi possível carregar os dados da sua imobiliária. Saia e entre novamente. Se o
        problema continuar, contate o suporte.
      </p>
    </div>
  );
}
