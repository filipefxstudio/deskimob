This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha os valores:

- `NEXT_PUBLIC_SITE_BASE_URL` — URL base do site em produção (ex.: `https://deskimob.vercel.app`)
- `RESEND_API_KEY` — chave da API [Resend](https://resend.com) para e-mails de leads do site (configurada uma vez na Vercel; vale para todas as contas).
- `RESEND_FROM_EMAIL` — remetente verificado no Resend (ex.: `Deskimob <noreply@seudominio.com.br>`). O destino é o e-mail da aba **Site → Contato** (ou e-mail da conta).
- `VERCEL_API_TOKEN` — token da API Vercel (somente servidor) para domínio próprio self-service na aba **Meu site**.
- `VERCEL_PROJECT_ID` — ID do projeto Vercel do Deskimob.
- `VERCEL_TEAM_ID` — (opcional) ID do time Vercel, se o projeto estiver em uma team.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
