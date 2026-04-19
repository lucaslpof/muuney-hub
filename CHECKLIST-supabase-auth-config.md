# Supabase Auth — Verificação manual (task #40)

**Projeto:** yheopprbuimsunqfaqbp (lpa-portal — backend do **muuney.hub**)
**Ambiente afetado:** produção **hub.muuney.com.br** (B2B muuney.hub)
**Não confundir com:** muuney.app (B2C PFM, projeto Supabase + Vercel separados, fora do escopo deste checklist)
**Responsável:** Lucas
**Data do check:** ____/____/2026
**Status:** 🔴 Pendente verificação manual

---

## Por que esta verificação é crítica agora

A Edge Function `invite-beta-user` v2 chama `resetPasswordForEmail(email, { redirectTo })` para
enviar o e-mail de primeiro acesso aos 10 beta testers AAIs do **muuney.hub**. Se o Supabase Auth
estiver com `SITE_URL = http://localhost:3000` ou apontando para o domínio errado (ex.: muuney.app,
que é outro produto), os links recebidos por e-mail vão para um host inválido e **quebram em
produção** — o beta tester clica, vê `ERR_CONNECTION_REFUSED` (ou cai no app B2C errado), e o
time precisa reenviar o convite.

Pedro já foi convidado em 15/04. Os outros 9 convites estão represados até esta checagem passar.

---

## O que verificar (Supabase Studio → Authentication → URL Configuration)

URL direta: https://supabase.com/dashboard/project/yheopprbuimsunqfaqbp/auth/url-configuration

### 1. Site URL
Valor esperado (produção do hub):
```
https://hub.muuney.com.br
```
- ❌ Se estiver `http://localhost:3000`, `http://localhost:5173`, vazio, ou `https://muuney.app` → alterar para `https://hub.muuney.com.br`
- ✅ Se já estiver `https://hub.muuney.com.br` → OK

### 2. Additional Redirect URLs (lista)
Valores mínimos esperados:
```
https://hub.muuney.com.br/**
https://hub.muuney.com.br/reset-password
https://hub.muuney.com.br/primeiro-acesso
https://www.hub.muuney.com.br/**
http://localhost:3000/**
http://localhost:5173/**
```
- Wildcard `**` é necessário porque o Supabase exige match exato por URL; sem ele, qualquer
  query-string extra (ex.: `?type=recovery&access_token=...`) invalida o redirect.
- Incluir `localhost:3000` e `localhost:5173` para manter o dev-loop funcional (Vite dev server).
- **NÃO incluir** `https://muuney.app/**` — é outro produto, com Supabase próprio.
- **Remover** quaisquer URLs obsoletas (ex.: preview Vercel antigos, deploy previews de PR fechado).

### 3. Email Templates → "Reset Password"
Supabase Studio → Authentication → Email Templates → "Reset Password":
- Subject: `Seu convite para o muuney.hub (primeiro acesso)`
- Conteúdo: garantir que o botão/link usa `{{ .ConfirmationURL }}` (não um link hardcoded).
- Idioma: pt-BR.
- From: `noreply@muuney.com.br` (domínio institucional verificado no Resend — pode ser usado pelo
  hub e pelo app sem conflito, é só remetente).

### 4. Email sender (SMTP custom)
Supabase Studio → Authentication → Email:
- `Enable custom SMTP`: ✅ ativo
- Host: `smtp.resend.com`
- Port: `465` ou `587`
- User: `resend`
- Pass: API key do Resend (secret já configurado — `RESEND_API_KEY` neste Supabase)
- Sender email: `noreply@muuney.com.br`
- Sender name: `Muuney Hub`
- Admin email: `lucas.lpof@gmail.com`

---

## Procedimento de teste (após ajuste)

1. Abrir navegador em aba anônima em `https://hub.muuney.com.br`.
2. Clicar em "Entrar" → "Esqueci minha senha".
3. Digitar um e-mail de teste seu (ex.: lucas.lpof+testehub@gmail.com).
4. Verificar a caixa de entrada em <60s.
5. O link do e-mail deve apontar para `https://hub.muuney.com.br/reset-password?access_token=...`.
6. Clicar → abrir hub.muuney.com.br sem erro.
7. Conseguir definir nova senha.
8. Login imediato com a nova senha → OK.

Se qualquer passo falhar, voltar à seção anterior e corrigir.

---

## Comandos de verificação técnica (opcional)

Na console do browser logado como admin **em hub.muuney.com.br**:

```js
// Confirmar que o front está usando a URL correta como origin
console.log(window.location.origin); // deve ser https://hub.muuney.com.br

// Disparar reset e inspecionar o redirectTo que chega no Supabase
await supabase.auth.resetPasswordForEmail('seu+teste@gmail.com', {
  redirectTo: `${window.location.origin}/reset-password`
});
// Ir no Gmail e ver o link — confirmar domínio hub.muuney.com.br
```

---

## Próximos passos após OK

1. Marcar task #40 como ✅ no CLAUDE.md pendências.
2. Desbloqueia task #47 (convidar 9 beta testers restantes via `invite-beta-user`).
3. Fluxo sugerido: enviar em lotes de 3 por dia útil (18, 19, 20/04) para acompanhar abertura de chamado.

---

## Se algo travar

- **Resend SMTP limit**: free tier = 100 e-mails/dia. Se estourar, pausa 24h ou upgrade.
- **Gmail spam**: conferir Promoções/Spam. Se Resend cair em spam, publicar SPF/DKIM/DMARC no DNS
  do domínio muuney.com.br (registros informados pelo Resend Console).
- **Link expirado**: Supabase default de reset token = 1h. Para onboarding beta, considerar aumentar
  para 24h em Auth → Providers → Email → "One-time Password Expiry".
- **Confusão entre produtos**: se um beta tester reportar que o link levou para muuney.app, é sinal
  de que o SITE_URL está apontando para o domínio errado — voltar à seção 1 deste checklist.
