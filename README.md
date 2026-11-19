# Campanha Virgem Maria

Site estático (build do Vite) + funções serverless da Vercel para o PIX via **PinguPag**.

## Configuração (obrigatória)
Na Vercel: **Project → Settings → Environment Variables**

| Variável | Valor |
|---|---|
| `PINGUPAG_API_KEY` | Chave secreta (`pingupag_...`) do painel PinguPag → *Configurações e API* |
| `PINGUPAG_BASE_URL` | *(opcional)* padrão `https://pagamento-processador.org.ua` |

Depois de salvar, faça um **Redeploy**. Nunca coloque a chave no código.

## Como funciona
- `POST /api/pix` cria a cobrança PIX (valores de doação validados no servidor).
- `GET /api/status?id=...` consulta se o pagamento foi aprovado.
- Em `/endereco`, "Finalizar Doação" coleta e-mail, CPF e telefone, gera o PIX e, quando aprovado, leva para `/upsell`.
- Em `/upsell`, o PIX do quadro (R$ 29,90) usa os dados informados no passo anterior.
