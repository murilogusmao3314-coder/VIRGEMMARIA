# Campanha Virgem Maria

Site estático (build do Vite) + funções serverless da Vercel para o PIX via **PinguPag**.

## Configuração (obrigatória)
Na Vercel: **Project → Settings → Environment Variables**

| Variável | Valor |
|---|---|
| `PINGUPAG_API_KEY` | Chave secreta (`pingupag_...`) do painel PinguPag → *Configurações e API* |
| `UTMIFY_API_TOKEN` | Credencial da Utmify: *Integrações → Webhooks → Credenciais de API → Adicionar Credencial* |
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
- A taxa do gateway não é informada: a comissão enviada é igual ao valor total.
