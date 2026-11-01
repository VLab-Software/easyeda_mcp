# Especificação de Ferramenta MCP: `easyeda_<nome_da_ferramenta>`

> **Status**: Proposta / Em Revisão / Aprovada / Implementada  
> **Fase**: Fase 0 / Fase 1 / Fase 2 / Fase 3 / Fase 4 / Fase 5  
> **Prioridade**: P0 / P1 / P2  
> **Domínio**: Documentos / Esquemático / PCB / Roteamento / Bibliotecas / Exportação  

---

## 1. Visão Geral e Propósito

- **Nome Canônico MCP**: `easyeda_<nome_da_ferramenta>`
- **Título Humano**: Nome conciso da ferramenta exibido em interfaces (Claude, Cursor, etc.).
- **Descrição**: Descrição clara em uma ou duas frases explicando exatamente o que a ferramenta faz e quando deve ser chamada pelo modelo.
- **Escopo de Execução**: `Local MCP Server` | `Schematic API (eda.sch_*)` | `PCB API (eda.pcb_*)` | `System/Workspace API (eda.dmt_*)`

---

## 2. Metadados e Anotações MCP

```json
{
  "readOnlyHint": false,
  "destructiveHint": false,
  "idempotentHint": true,
  "openWorldHint": false
}
```

- **`readOnlyHint`**: `true` se apenas inspeciona dados; `false` se cria, move, deleta ou altera documentos.
- **`destructiveHint`**: `true` se exclui peças, remove trilhas, limpa rotas ou altera regras de placa.
- **`idempotentHint`**: `true` se chamadas repetidas com os mesmos argumentos produzem o mesmo estado final.
- **`openWorldHint`**: `false` (opera no escopo fechado do editor local e RPC bridge).

---

## 3. Schema Zod de Entrada (`inputSchema`)

```typescript
import * as z from "zod/v4";

export const EasyEda<ToolName>InputSchema = z.strictObject({
  // Descreva cada parâmetro com .describe(), limites min/max e defaults seguros
  paramExemplo: z.string().min(1).describe("Identificador do elemento no canvas."),
  timeoutMs: z.number().int().positive().max(120_000).default(10_000)
});

export type EasyEda<ToolName>Input = z.infer<typeof EasyEda<ToolName>InputSchema>;
```

### Tabela de Parâmetros

| Parâmetro | Tipo | Obrigatório? | Padrão | Descrição |
| :--- | :---: | :---: | :---: | :--- |
| `paramExemplo` | `string` | Sim | - | Identificador único ou designador. |
| `timeoutMs` | `number` | Não | `10000` | Timeout do RPC em milissegundos ($\le 120000$). |

---

## 4. Contrato RPC e Mapeamento da API Nativa EasyEDA

- **Método RPC do Bridge**: `<rpcMethodName>`
- **Payload RPC Enviado**:
  ```json
  {
    "kind": "call",
    "requestId": "uuid",
    "method": "<rpcMethodName>",
    "params": { ... }
  }
  ```
- **API Nativa EasyEDA Pro Chamada**:
  ```javascript
  // Exemplo de chamada na extensão
  eda.sch_PrimitiveComponent.moveTo(uuid, x, y);
  ```
- **Guarda de Capacidade**: Checagem prévia com `ensureApi("<modulo>", "<metodo>")`.

---

## 5. Estrutura de Retorno e Evidências

### Payload de Sucesso
```json
{
  "summary": "Descrição sucinta do resultado.",
  "status": "applied | ok",
  "evidence": {
    "target": {
      "documentUuid": "...",
      "documentType": "schematic | pcb"
    },
    "modifiedIds": ["..."]
  },
  "warnings": []
}
```

### Modos de Falha e Códigos de Erro Estruturados

| Código de Erro | Condição | Ação de Remediação |
| :--- | :--- | :--- |
| `api_unavailable` | EasyEDA Pro não possui o método na versão atual | Atualizar EasyEDA Pro ou usar alternativa |
| `wrong_document` | Documento ativo não é do tipo esperado | Abrir documento correspondente com `easyeda_open_document` |
| `validation_error` | Coordenadas inválidas ou parâmetros fora de range | Ajustar parâmetros enviados |
| `timeout` | Bridge não respondeu no tempo limite | Consultar status com `easyeda_live_status` sem repetir mutações incertas |

---

## 6. Governança de Mutações (Apenas para ferramentas com `readOnlyHint: false`)

- **Exige Confirmação em Duas Fases?**: `Sim | Não`
- **Formato da Confirmação**: `CONFIRM <action> <editId>` ou parâmetro `confirm: true`
- **Estratégia de Readback**: Ler o canvas após alteração e verificar se o estado solicitado foi aplicado.
- **Rollback / Cancelamento**: Comportamento em caso de falha parcial ou timeout.

---

## 7. Plano de Testes Automatizados (Vitest & Smoke)

1. **Testes Unitários no Vitest**:
   - Validação do schema Zod (rejeição de payloads vazios, tipos errados, limites excedidos).
   - Mock da API `eda.*` cobrindo cenário de sucesso, erro de API ausente e parâmetros malformados.
2. **Smoke Test de Integração**:
   - Procedimento automatizado no script `scripts/smoke-<dominio>.mjs`.
