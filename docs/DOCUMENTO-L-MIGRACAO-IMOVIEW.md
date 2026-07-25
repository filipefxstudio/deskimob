# Documento L — Migração de Imóveis do Imoview para o Deskimob

> **Spec de implementação completa.** Cole este documento inteiro em um chat novo dedicado à implementação.
>
> **Repositório:** `C:\Users\mktim\Desktop\FX\fxstudio` (Deskimob / Next.js 16 App Router + Supabase)
>
> **Objetivo do chat:** implementar a ferramenta permanente de importação conforme este documento.

---

## 0. Instruções para o agente implementador

1. Ler este documento por completo antes de codar.
2. Reutilizar código existente do projeto (`slugify`, `generateImovelSlug`, upload Storage, service role, etc.) — **não duplicar** lógica de `createImovel` via UI; usar inserts diretos via **service role** na importação em massa.
3. Implementar em fases (seção 16). Entregar Fase 0 + 0.5 + 1 antes de fotos.
4. **Não** expor rota em menus. Acesso restrito (seção 2).
5. Conferir valores reais no Supabase produção antes de hardcodar enums — especialmente `desativado_temporariamente` e lista de `diferenciais`.
6. Build deve passar (`npm run build`). Não commitar `.env` nem XLS com dados sensíveis.
7. Dependência nova necessária: parser XLS (`xlsx` ou `exceljs`).

---

## 1. Objetivo

Criar ferramenta **interna e permanente** (não descartável) para migrar carteira de imóveis do **Imoview** para o **Deskimob**, a partir de:

1. **XLS exportado do Imoview** (relatório "Indicadores", ~2.190 imóveis, 159 colunas) — fonte principal.
2. **API pública do site Imobee** (`imobee.net`) — complementar, só para imóveis com página ativa no site (~252), para fotos (já comprimidas) e título do anúncio.

Futuro: reutilizar para outros clientes Deskimob que usem Imoview. Por ora, acesso só conta do desenvolvedor.

---

## 2. Controle de acesso

- **Rota UI:** `/admin/importar-imoview` (sem link em sidebar/menus).
- **APIs:** `/api/admin/imoview/*` — mesma restrição.
- Permitir **apenas** se usuário autenticado tiver `corretor_id = 400bbcb9-4c2d-43c2-af04-f2b7996618b2` (conta `filipe@imobee.net`).
- Qualquer outro: **403** (ou redirect `/dashboard`).
- Implementar helper: `lib/auth/imoview-import-access.ts` → `requireImoviewImportAccess()`.

---

## 3. Valores fixos de referência

Usar em **todos** os registros desta migração:

| Campo | Valor |
|---|---|
| `imoveis.corretor_id` | `400bbcb9-4c2d-43c2-af04-f2b7996618b2` |
| `clientes.corretor_id` | `400bbcb9-4c2d-43c2-af04-f2b7996618b2` |
| `imovel_captadores.perfil_id` (principal) | `82d8eff4-4dc3-4169-9dc1-5b12b117b0e5` (Filipe) |
| `imovel_captadores.principal` | `true` |

Centralizar em `lib/imoview/constants.ts`.

---

## 4. Correções de schema (IMPORTANTE — código real vs spec original)

Conferido no codebase Deskimob. **Usar estes nomes**, não os do Imoview/doc anterior:

| Spec antiga | Coluna/campo real no Deskimob |
|---|---|
| `local_chaves_codigo` | **`chaves_codigo`** |
| `na_planta` + `imovel_na_planta` | Só **`imovel_na_planta`** |
| `quantidade_salas` | Só **`salas`** |
| `quantidade_elevadores` | Só **`elevadores`** |
| `eh_captador_principal` | **Não existe** — usar **`principal`** |
| `eh_parceiro_externo` | **Não existe** no schema/migrations |
| `complemento` (planilha) | Gravar em **`complemento`** e **`complemento_valor`** (legado; ver `buildComplementoString`) |

### Captador — regra correta

O app usa `imovel_captadores.principal` e `getCaptadorPrincipal()` (`lib/imoveis/captador.ts`).

Para esta migração:

```
imovel_captadores.imovel_id  = <id do imóvel>
imovel_captadores.perfil_id  = "82d8eff4-4dc3-4169-9dc1-5b12b117b0e5"
imovel_captadores.principal  = true
imovel_captadores.nome_externo = null   // opcional: null; perfil já identifica Filipe
```

**Não** marcar como captador externo se `perfil_id` está preenchido. Campo `Captadores` da planilha é informativo; UI mostrará nome do perfil.

Também preencher legado `imoveis.captador_id = 82d8eff4-...` se outros fluxos ainda leem essa coluna.

---

## 5. Limite de plano Deskimob (app)

`IMOVEL_LIMITS.basico = 30` (`lib/constants/imoveis.ts`) — bloqueia `createImovel` via UI.

Importação em massa usa **service role** (bypass). Mesmo assim:

- Antes da migração, garantir `assinaturas.plano = 'profissional'` ou `'premium'` para este corretor (limite `null`).
- Documentar no relatório se plano ainda for básico.

---

## 6. Fonte 1 — Arquivo XLS

- 1 aba ("Planilha1"), ~2.190 linhas, 159 colunas.
- Adicionar lib: `xlsx` (SheetJS) ou `exceljs`.

### 6.1 Mapeamento direto planilha → `imoveis`

| Coluna XLS | Campo Deskimob | Transformação |
|---|---|---|
| `Codigo` | `codigo` | string |
| `Finalidade` | `finalidade` | `"venda"` (planilha só venda) |
| `Tipo` | `tipo` | lowercase; mapear para `TIPOS_IMOVEL` (`apartamento`, `casa`, `terreno`, `comercial`, `cobertura`, `studio`) |
| `MotivoDesativacao` | `motivo_desativacao` | direto |
| `Cep` | `cep` | só dígitos (padrão app: `sanitizeCep`) |
| `Endereco` | `logradouro` | direto |
| `EnderecoNumero` | `numero` | string |
| `Complemento` | `complemento`, `complemento_valor` | direto |
| `Bairro` | `bairro` | direto |
| `Cidade` | `cidade` | direto |
| `Estado` | `estado` | UF 2 letras |
| `Descricao` | `descricao` | direto |
| `NumeroQuarto` | `quartos` | float→int, NaN→0 ou null (seguir padrão NOT NULL da tabela) |
| `NumeroSuite` | `suites` | idem |
| `NumeroBanheiro` | `banheiros` | idem |
| `NumeroVaga` | `vagas` | idem |
| `NumeroSala` | `salas` | float→int |
| `NumeroElevador` | `elevadores` | float→int |
| `Exclusivo` | `exclusividade` | Sim→true, Não→false |
| `NaPlanta` | `imovel_na_planta` | Sim/Não→boolean |
| `Valor` | `valor_venda` | parse monetário BR |
| `ValorCondominio` | `valor_condominio` | parse monetário |
| `ValorIptu` | `valor_iptu` | parse monetário |
| `AreaInterna` | `area_util` | parse área |
| `AreaLote` | `area_total` | parse área |
| `LocalChave` | `local_chaves` | normalizar (6.5) |
| `IdenticadorChave` | `chaves_codigo` | direto |
| `DataCadastro` | `data_ativacao` | dd/mm/yyyy → ISO timestamp |
| `DataHoraUltimaAlteracao` | `data_ultima_atualizacao` | dd/mm/yyyy → ISO |
| `TipoVaga` | `vagas_tipo` | normalizar texto |
| `Idade` | `ano_construcao` | regra especial (6.4) |
| `Destinacao` | `destinacao` | lowercase: `residencial`, `comercial`, `rural` |

Campos fixos adicionais:

| Campo | Valor |
|---|---|
| `destaque_site` | `false` |
| `visualizacoes` | `0` |
| `publicado_portais` | `false` (não migrar flags de portal) |
| `exibir_endereco_site` | `apenas_bairro` (default app) |
| `exibir_endereco_portais` | `apenas_bairro` |
| `imovel_ocupado`, `contrato_aluguel_ativo`, `aceita_financiamento`, `aceita_permuta` | `null` via planilha; API preenche os 252 (seção 10) |
| `latitude`, `longitude` | `null` via planilha; API preenche os 252 |

### 6.2 Parse monetário

`"1.390.000,00"` → remover `.` milhar, `,` → `.`, `parseFloat`.

- Vazio/NaN → `null`
- `"0,00"` explícito → `0`

### 6.3 Parse área

`"140m²"`, `"180,00"` → remover `m²`, trim, decimal BR → numeric.

### 6.4 Idade → ano_construcao

- Extrair número antes de `"anos"`.
- Ano de referência = **ano da exportação do XLS** (metadata do arquivo ou informado na UI), **não hardcode 2026**.
- Se número ≤ 150: `ano_construcao = ano_exportacao - numero`
- Se número > 150 (ex.: `"2026 anos"` bug Imoview): `null`
- Vazio: `null`

### 6.5 local_chaves

Valores app (`LocalChaves`): `imobiliaria`, `proprietario`, `portaria`, `outros`.

| Imoview | Deskimob |
|---|---|
| Proprietário | `proprietario` |
| Imobiliária | `imobiliaria` |
| Portaria | `portaria` |
| Outros | `outros` + texto original em **`chaves_descricao`** |

Se `local_chaves = imobiliaria` e houver `IdenticadorChave`, gravar em `chaves_codigo`.

### 6.6 Padronização enums

Antes de gravar, consultar (ou cachear na análise) `SELECT DISTINCT tipo, finalidade, destinacao, local_chaves, vagas_tipo FROM imoveis WHERE corretor_id = ...`.

Tipos válidos: `lib/constants/imoveis.ts` → `TIPOS_IMOVEL`, `FINALIDADES_IMOVEL`, `DESTINACOES_IMOVEL`.

Imóvel com tipo desconhecido → log warning + mapear para `comercial` ou falha controlada (configurável).

---

## 7. Proprietários (`clientes` + `imoveis.cliente_id`)

- **`imoveis.cliente_id`** = proprietário **principal** (1º titular).
- **`imovel_proprietarios`** = não usar nesta migração (planilha traz 1 proprietário por imóvel).

### 7.1 Parsing `Proprietarios`

Formato variável separado por `|`:

- `Nome | Telefone`
- `Nome | Telefone | Email`
- `Nome | CPF: xxx | Telefone(s) | Email`

Algoritmo:

1. Split `|`, trim.
2. Parte 0 = `nome`.
3. Demais partes:
   - começa com `CPF:` → extrair cpf
   - contém `@` → email
   - senão → telefone(s); usar **primeiro** antes de vírgula

### 7.2 Deduplicação clientes

Antes de insert, buscar `clientes` com mesmo **telefone normalizado** (só dígitos) e `corretor_id` fixo.

- Existe → reutilizar `id`
- Não existe → insert:

```typescript
{
  corretor_id: "400bbcb9-4c2d-43c2-af04-f2b7996618b2",
  nome, telefone, email, cpf,
  tipo: "proprietario",
  perfil_id: null,
}
```

### 7.3 Sem telefone

`clientes.telefone` é NOT NULL → **não criar cliente**; `imoveis.cliente_id = null`; logar código do imóvel para revisão manual. **Não abortar** importação.

---

## 8. Status (`status_imovel_id` + `status`)

Corretor: `400bbcb9-4c2d-43c2-af04-f2b7996618b2`.

| `Situacao` (Imoview) | Qtd. | `imoveis.status` | `status_imovel_id` |
|---|---|---|---|
| Vago/Disponível | 269 | `disponivel` | `886e405f-2a34-43db-917b-3afed4cfb811` |
| Desativado | 1.514 | `desativado` | `1e1cfa9b-75bb-4765-b093-3b7d605dce09` |
| Em moderação | 314 | `em_cadastro` | `41b57bea-3b66-4ea9-b66f-903066112266` |
| Vendido | 87 | `vendido` | `3a056eb6-9397-4255-add5-41ea35fbcf68` |
| Em reforma | 5 | **`desativado_temporariamente`** ⚠️ | `dd9caa14-43e7-495e-9612-6c6a9875b530` |
| Alugado | 1 | `locado` | `92042a1a-1ba2-4d82-a84a-68a9107d3411` |

⚠️ **`desativado_temporariamente`** existe no banco (status custom SQL) mas **não** está no type `StatusImovelSlug` do TypeScript. Confirmar slug exato em produção antes do lote; estender type se necessário.

Migrar **todos** os 2.190 — não filtrar por status.

### 8.1 status_aprovacao (campo extra — obrigatório no app)

Valores: `em_cadastro` | `aguardando_aprovacao` | `aprovado`.

| Situação migrada | `status_aprovacao` sugerido |
|---|---|
| Vago/Disponível (publicado site) | `aprovado` |
| Vago/Disponível (sem site) | `aprovado` |
| Em moderação | `em_cadastro` |
| Desativado, Vendido, Locado, Em reforma | `aprovado` |

---

## 9. Diferenciais (`diferenciais` text[])

Colunas booleanas Sim/Não → incluir no array se "Sim".

**Fonte da verdade:** cruzar rótulos com `DIFERENCIAIS_OPCOES` em `lib/constants/imoveis.ts` e valores já gravados em produção. Criar mapa Imoview→Deskimob em `lib/imoview/diferenciais-map.ts`.

Mapa proposto (ajustar para bater com constantes reais):

| Coluna XLS | Rótulo array |
|---|---|
| ArCondicionado | Ar condicionado |
| AreaServico | Área de serviço |
| AreaPrivativa | Área privativa |
| ArmarioBanheiro | Armário no banheiro |
| ArmarioCozinha | Armário na cozinha |
| ArmarioQuarto | Armário embutido no quarto |
| Closet | Closet |
| Despensa | Despensa |
| Escritorio | Escritório |
| Lavabo | Lavabo |
| Mobiliado | Mobiliado |
| Rouparia | Rouparia |
| SolManha | Sol da manhã |
| VistaMar | Vista para o mar |
| AguaIndividual | Água individual |
| Alarme | Alarme |
| AquecimentoEletrico | Aquecimento elétrico |
| AquecimentoGas | Aquecimento a gás |
| AquecimentoSolar | Aquecimento solar |
| CercaEletrica | Cerca elétrica |
| CircuitoTv | Circuito de TV |
| GasCanalizado | Gás canalizado |
| Interfone | Interfone |
| Jardim | Jardim |
| Lavanderia | Lavanderia |
| PortaoEletronico | Portão eletrônico |
| Portaria24H | Portaria 24h |
| Academia | Academia |
| Churrasqueira | Churrasqueira |
| Hidromassagem | Hidromassagem |
| HomeCinanema | Home cinema |
| Piscina | Piscina |
| Playground | Playground |
| QuadraPoliesportiva | Quadra poliesportiva |
| QuadraTenis | Quadra de tênis |
| SalaMassagem | Sala de massagem |
| SalaoFestas | Salão de festas |
| SalaoJogos | Salão de jogos |
| Sauna | Sauna |
| Wifi | Wi-Fi |

Se rótulo não existir na lista padrão do app, incluir mesmo assim no array **ou** logar — definir na implementação após conferir filtros do site.

---

## 10. Colunas XLS que NÃO migrar

Portais (`PortalOlxBrasil`, `PortalImovelWeb`, etc.), empreendimento/condomínio como entidade (`Empreendimento`, `Condominio`, `Administradora*`), chaveiro detalhado, `NumeroControle`, `HorarioVisita`, `Etiquetas`, `Pontuacao`, `ZonaUso`, campos industriais/comerciais ausentes nesta planilha residencial. Fase 2 futura se necessário.

---

## 11. Fonte 2 — API Imobee (fotos + título)

Aplica-se a imóveis com **`ExibirMeuSite = "Sim"`** AND **`Situacao = "Vago/Disponível"`** (~252).

Fotos do Imobee **já vêm comprimidas** — usar na estimativa de storage ~80–250 KB/foto (validar via amostra).

### 11.1 Metadados por código

```http
POST https://www.imobee.net/imoveis/codigos/
Content-Type: application/x-www-form-urlencoded

codigo=<codigo>&finalidade=venda
```

Resposta JSON `lista[0]`: `titulo` (slug URL), `latitude`, `longitude`, `aceitafinanciamento`, `aceitapermuta`, `fotos[]` com `url`, `descricao`.

Preencher adicionalmente:

- `latitude`, `longitude`
- `aceita_financiamento`, `aceita_permuta`
- `publicado_site = true` (demais ~1.938 → `false`)

### 11.2 Título real (og:title)

1. URL: `https://www.imobee.net/imovel/{slug}/{codigo}`
2. GET HTML
3. Extrair `<meta property="og:title" content="...">`
4. `imoveis.titulo` = conteúdo limpo
5. `imoveis.slug` = `generateImovelSlug(titulo, cidade)` de `lib/utils.ts`

### 11.3 Fotos — upload Storage

Para cada `fotos[i].url`:

1. Download imagem
2. Validar magic bytes (JPEG/PNG/WebP) — **rejeitar** se corrompida (lição: uploads UTF-8 corrompem imagens)
3. Upload bucket `imoveis-fotos` path: `{corretor_id}/{imovel_id}/{uuid}.{ext}`
4. Usar **`Blob`/`Uint8Array`** no upload (não Buffer raw) — ver `lib/supabase/storage-upload.ts`
5. Insert `imovel_fotos`:

```typescript
{
  imovel_id,
  url: buildStoragePublicUrl("imoveis-fotos", path),
  ordem: i,        // 0-based
  legenda: descricao || null,
}
```

Service role obrigatório. Retry 2x por foto. Rate limit (~200ms entre requests).

---

## 12. Título para imóveis sem site (~1.938)

Gerar automaticamente:

```
"{Tipo label} em {Bairro}, {area_util}m², {quartos} quartos"
```

Ex.: `"Casa em Santa Amélia, 140m², 3 quartos"`. Omitir partes null. Slug via `generateImovelSlug(titulo, cidade)`.

Garantir slug único por corretor (reutilizar `ensureUniqueImovelSlug` de `lib/actions/imoveis.ts` ou extrair helper).

---

## 13. Idempotência

Antes de insert, verificar:

```sql
SELECT id FROM imoveis
WHERE corretor_id = '400bbcb9-...' AND codigo = '<Codigo planilha>'
```

- Existe → **pular** (default), contabilizar "já existente"
- Futuro (opcional): checkbox UI "Sobrescrever existentes" — fora do MVP

Mesma lógica para fotos: se imóvel já tem fotos, pular download salvo flag sobrescrever.

---

## 14. Fase 0.5 — Estimativa automática de Storage (OBRIGATÓRIA)

Rodar no **"Analisar planilha"**, **antes** de qualquer download de foto.

### 14.1 Objetivo

Responder:

- Quantos imóveis terão fotos
- Total de fotos
- Tamanho estimado no Storage
- Uso atual + projeção vs limite Supabase (Free 1 GB / Pro 100 GB)
- Semáforo verde/amarelo/vermelho

### 14.2 Fluxo

1. Parse XLS
2. Filtrar elegíveis: `ExibirMeuSite = "Sim"` AND `Situacao = "Vago/Disponível"`
3. Para cada elegível (ou batch): POST API Imobee → contar `fotos.length` (**sem baixar imagens**)
4. Amostra **15–20 imóveis** (estratificado por contagem de fotos)
5. Para URLs da amostra: HTTP **HEAD** → `Content-Length` (fallback: GET Range bytes 0-0)
6. Calcular mediana e **P90** tamanho/foto
7. Estimativa: `total_fotos × P90 × 1.10` (margem 10%)
8. Consultar uso atual bucket `imoveis-fotos` (listagem admin ou soma conhecida)
9. Projeção DB: ~35 MB para 2190 imóveis + clientes (fixo conservador)

### 14.3 Semáforo

Config em `lib/imoview/constants.ts`:

```typescript
export const STORAGE_ESTIMATE_CONFIG = {
  freeLimitBytes: 1_073_741_824,      // 1 GB
  proLimitBytes: 107_374_182_400,     // 100 GB
  warningThreshold: 0.70,
  blockThreshold: 0.90,
  safetyMargin: 1.10,
  photoSampleSize: 20,
} as const;
```

| Projeção / limite | Status | Comportamento import fotos |
|---|---|---|
| < 70% | `green` | Permitir |
| 70–90% | `yellow` | Exigir checkbox confirmação na UI |
| > 90% | `red` | Bloquear fotos; importar só planilha |

Plano Supabase: env `SUPABASE_PLAN=free|pro` ou seletor manual na UI se billing API indisponível.

### 14.4 Resposta API `/api/admin/imoview/analyze`

```typescript
type AnalyzeResponse = {
  spreadsheet: {
    totalRows: number;
    bySituacao: Record<string, number>;
    proprietariosSemTelefone: number;
    byTipo: Record<string, number>;
  };
  photos: {
    eligibleCount: number;
    totalPhotoCount: number;
    sampleSize: number;
    avgBytesPerPhoto: number;
    p90BytesPerPhoto: number;
    estimatedBytes: number;
    estimatedLabel: string; // "473 MB"
  };
  storage: {
    plan: "free" | "pro";
    limitBytes: number;
    usedBytes: number;
    projectedBytes: number;
    percentUsed: number;
    status: "green" | "yellow" | "red";
    recommendation: string;
  };
  database: {
    estimatedNewBytes: number;
    limitBytes: number;
    status: "green";
  };
};
```

### 14.5 Durante importação (Fase 3)

- Acumular bytes reais vs estimados
- Relatório final: `estimado X MB → real Y MB`
- Se desvio > 30% durante lote: pausar fotos e alertar

### 14.6 Referência com fotos comprimidas

| Premissa | 252 imóv × 10 fotos |
|---|---|
| ~80 KB/foto | ~200 MB |
| ~150 KB/foto | ~380 MB |
| ~250 KB/foto | ~630 MB |

Free (1 GB) **provavelmente cabe** se fotos já comprimidas e bucket não estiver cheio — **mas só a estimativa confirma**.

---

## 15. UI/UX

Rota: `/admin/importar-imoview` (sem menu).

### Passo 1 — Upload XLS

### Passo 2 — "Analisar planilha"

Mostrar:

- Totais por status, tipo
- Proprietários sem telefone (count)
- **Painel estimativa Storage** (seção 14)
- Quantos imóveis buscarão fotos/título na API

### Passo 3 — "Iniciar importação"

- Modo teste: input "Limitar a N imóveis" (default MVP: 10)
- Checkbox se `yellow`: "Entendo risco de Storage"
- Progresso: `342 / 2.190` + sub-progresso fotos
- Polling job: `GET /api/admin/imoview/jobs/[id]`

### Passo 4 — Relatório final

- Importados com sucesso
- Pulados (já existentes)
- Erros com motivo por código
- Fotos baixadas / falhas
- Clientes criados vs reaproveitados
- Proprietários sem telefone (lista códigos)
- Storage: estimado vs real
- Download log JSON/CSV

---

## 16. Arquitetura técnica

### 16.1 Por que fila assíncrona

2.190 imóveis + 252 com fotos **estoura timeout** Vercel (60–300s). Obrigatório processamento em chunks.

### 16.2 Tabelas de job (migration nova)

```sql
CREATE TABLE imoview_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corretor_id UUID NOT NULL REFERENCES corretores(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending|running|completed|failed|cancelled
  total_rows INT NOT NULL DEFAULT 0,
  processed_rows INT NOT NULL DEFAULT 0,
  imported_count INT NOT NULL DEFAULT 0,
  skipped_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  photos_downloaded INT NOT NULL DEFAULT 0,
  options JSONB NOT NULL DEFAULT '{}',
  summary JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE imoview_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES imoview_import_jobs(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  status TEXT NOT NULL, -- ok|skipped|error
  message TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

RLS: apenas service role escreve; leitura via API autenticada com `requireImoviewImportAccess`.

Alternativa MVP: script local `scripts/imoview-import.mjs` reutilizando `lib/imoview/*` — depois embutir na UI.

### 16.3 Estrutura de arquivos

```
lib/imoview/
  constants.ts              # IDs fixos, thresholds storage, mapa status
  types.ts                  # XlsRow, ImportOptions, AnalyzeResponse
  parse-xls.ts
  parse-proprietario.ts
  parse-money.ts
  parse-area.ts
  parse-idade.ts
  parse-data-br.ts
  normalize-enums.ts
  diferenciais-map.ts
  map-row-to-imovel.ts
  dedupe-clientes.ts
  fetch-imobee-metadata.ts
  fetch-imobee-title.ts     # og:title scrape
  estimate-storage.ts
  get-storage-usage.ts
  import-single-imovel.ts   # 1 linha XLS → DB
  import-photos.ts
  import-runner.ts          # loop + idempotência
  slug-unique.ts

lib/auth/imoview-import-access.ts

app/(dashboard)/admin/importar-imoview/page.tsx
app/api/admin/imoview/analyze/route.ts
app/api/admin/imoview/import/route.ts      # POST cria job
app/api/admin/imoview/jobs/[id]/route.ts   # GET status
app/api/admin/imoview/jobs/[id]/tick/route.ts  # POST processa N itens (cron ou polling)

supabase/migrations/YYYYMMDDHHMMSS_imoview_import_jobs.sql

scripts/imoview-import.mjs   # opcional CLI para dev
```

### 16.4 Processamento por tick

Cada `tick` processa **5–10 imóveis sem foto** ou **1–2 com foto**.

Ordem por imóvel:

1. Idempotência (`codigo`)
2. Cliente (dedupe telefone)
3. Insert `imoveis`
4. Insert `imovel_captadores`
5. Se elegível fotos AND storage semáforo ok: API Imobee + fotos
6. Log linha

Usar transação por imóvel onde possível; falha isolada não aborta job inteiro.

### 16.5 Reutilizar do projeto existente

| Necessidade | Onde |
|---|---|
| Service role | `lib/supabase/admin.ts` |
| Upload fotos | `lib/supabase/storage-upload.ts`, `buildStoragePublicUrl` |
| Slug | `generateImovelSlug`, `slugify` em `lib/utils.ts` |
| Bucket | `STORAGE_BUCKET_IMOVEIS` em `lib/constants/imoveis.ts` |
| CEP | `sanitizeCep` pattern em `lib/actions/imoveis.ts` |

**Não** chamar `createImovel` server action — insert direto admin.

---

## 17. Fases de entrega

| Fase | Escopo | Critério de done |
|---|---|---|
| **0** | Migration jobs + access control + constants | Rota 403 para outros users |
| **0.5** | `/analyze` com estimativa storage | Painel semáforo funcional com XLS real |
| **1** | Import planilha sem fotos + idempotência | 10 imóveis teste OK no banco |
| **2** | Fila + UI progresso + logs | 100 imóveis sem timeout |
| **3** | API Imobee + fotos + título (252) | 1 imóvel com fotos end-to-end |
| **4** | UI completa + relatório + download log | Import completo 2190 |
| **5** (backlog) | Sobrescrever, multi-tenant, locação | — |

**Ordem:** 0 → 0.5 → 1 → teste 10 → 2 → import planilha completa → 3 fotos → 4 polish.

---

## 18. Testes obrigatórios antes da carteira inteira

1. **10 imóveis** mix status (incl. Em reforma, sem telefone proprietário)
2. **1 imóvel** dos 252 com fotos + og:title
3. Re-run idempotência (10 pulados, 0 duplicados)
4. Conferir no Supabase: `codigo`, `status_imovel_id`, `cliente_id`, captador, diferenciais
5. Abrir 2 imóveis no dashboard e no site público (1 publicado)

---

## 19. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Timeout Vercel | Fila + ticks |
| Storage Free estourar | Estimativa 0.5 + semáforo |
| Fotos corrompidas | Magic bytes + `storage-upload.ts` |
| Tipo Imoview inválido | Mapa + fallback + log |
| `desativado_temporariamente` | Confirmar slug produção |
| Plano básico 30 imóveis | Upgrade assinatura ou bypass documentado |
| API Imobee fora | Retry + log códigos falhos |
| og:title scrape quebrado | Fallback título gerado (seção 12) |

---

## 20. Variáveis de ambiente necessárias

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # obrigatório para import
SUPABASE_PLAN=free                    # ou pro — para estimativa
```

Vercel: aumentar timeout se possível; senão ticks pequenos.

---

## 21. Comando sugerido para iniciar implementação

No chat novo, após colar este documento:

> Implemente o Documento L conforme `docs/DOCUMENTO-L-MIGRACAO-IMOVIEW.md`. Comece pelas Fases 0, 0.5 e 1. O arquivo XLS está em `[CAMINHO DO ARQUIVO]`. Rode teste com 10 imóveis antes de escalar.

Substituir `[CAMINHO DO ARQUIVO]` pelo path real do XLS no workspace ou máquina.

---

## 22. Checklist pré-voo (humano)

- [ ] Migration `20260721160000` status_imovel aplicada na conta Imobee
- [ ] `assinaturas.plano` = profissional ou premium para corretor Imobee
- [ ] XLS exportado disponível para o agente
- [ ] Confirmar slug `desativado_temporariamente` no banco (5 imóveis Em reforma)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` na Vercel
- [ ] Backup Supabase antes do import completo

---

*Documento gerado para implementação. Versão: 2026-07-25.*
