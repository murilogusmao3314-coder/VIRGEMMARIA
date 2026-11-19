# Campanha Virgem Maria

Site estático (build do Vite) + funções serverless da Vercel para o PIX via **PinguPag**.

## Configuração (obrigatória)
Na Vercel: **Project → Settings → Environment Variables**

| Variável | Valor |
|---|---|
| `PINGUPAG_API_KEY` | Chave secreta (`pingupag_...`) do painel PinguPag → *Configurações e API* |
| `UTMIFY_API_TOKEN` | Credencial da Utmify: *Integrações → Webhooks → Credenciais de API → Adicionar Credencial* |
| `META_ACCESS_TOKEN` | Token da API de Conversões: Gerenciador de Eventos → pixel → Configurações → *Gerar token de acesso* |
| `PINGUPAG_BASE_URL` | *(opcional)* padrão `https://pagamento-processador.org.ua` |

Depois de salvar, faça um **Redeploy**. Nunca coloque a chave no código.

## Como funciona
- `POST /api/pix` cria a cobrança PIX (valores de doação validados no servidor).
- `GET /api/status?id=...` consulta se o pagamento foi aprovado.
- Em `/endereco`, "Finalizar Doação" coleta e-mail, CPF e telefone, gera o PIX e, quando aprovado, leva para `/upsell`.
- Em `/upsell`, o PIX do quadro (R$ 29,90) usa os dados informados no passo anterior.

## Utmify (envio de vendas)
- Ao gerar o PIX: envia a venda como `waiting_payment`.
- `POST /api/webhook` (a URL é enviada automaticamente à PinguPag como `postback_url`): quando o status muda, o servidor **confirma na PinguPag** e envia `paid`, `refunded` ou `chargedback` à Utmify.
- Sem `UTMIFY_API_TOKEN`, o envio é simplesmente ignorado (o PIX continua funcionando).
- Taxa do gateway considerada: 5,99% + R$ 2,00 por venda (`GATEWAY_FEE_PERCENT` e `GATEWAY_FEE_FIXED_CENTS` permitem ajustar). A comissão enviada = valor − taxa.

## Meta Pixel + API de Conversões (sem duplicar)
- O navegador dispara os eventos do funil (cada um **uma única vez** por sessão, com `eventID`).
- `Purchase` sai **também do servidor** (no webhook), mesmo que o cliente pague e não volte ao site.
- O `eventID` da compra é `purchase-<referência do pedido>` nos dois lados, então a Meta conta **1 venda só**.
- Utmify: o `orderId` é a mesma referência; reenvios do webhook são idempotentes (mesmos dados/datas).
- Proteções: clique duplo no botão, reabrir a janela do PIX (reaproveita o PIX ainda válido) e recarregar a página não geram novo PIX nem novos eventos.
- Para testar sem poluir os dados: defina `META_TEST_EVENT_CODE` (aba *Testar eventos* do Gerenciador) e remova depois.
