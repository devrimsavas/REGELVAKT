# Regelvakt

Regelvakt shows small Norwegian businesses which official obligations apply to *their* company, explains them in plain language, reminds them before deadlines, and answers questions with sources from official pages.

> Status: early development (pilot). Not tax or accounting advice.

## The problem

Small businesses struggle less with *doing* their obligations than with *understanding* which ones apply to them.

In Fiken's survey of small businesses (0–5 employees), the two hardest parts of running a business were:

- Finding and understanding information on sites like Skatteetaten and Altinn: **51.3 %**
- Annual accounts and the tax return: **43.2 %**

Source: [Fiken – Forenkling for næringslivet](https://www.regjeringen.no/contentassets/a4b761c84e654b65a0ec33085ad7530d/forenkling-for-naringslivet-_-rapport-fra-fiken.pdf)

## How it works

1. **Enter an organisation number.** Organisation form, VAT registration, employees, industry code and founding date are fetched from Brønnøysundregistrene.
2. **Answer a few short questions.** Questions depend on organisation form and VAT status (e.g. expected sales, payroll, expected profit).
3. **See "Your obligations".** Each obligation shows a short explanation, the next deadline, the official source and a link to Altinn.
4. **Ask a question.** An AI assistant answers from a knowledge base built on official pages and always cites its source.
5. **Get reminders.** Optional email reminders before deadlines.

### What it is not

Not an accounting system and not an accountant. Regelvakt does not file anything or keep books. It answers one question: *what applies to me, when, and what does it mean?*

## Rule engine (overview)

| Input | Source |
| --- | --- |
| Organisation form (ENK / AS), VAT registration, employees, industry code | Brønnøysundregistrene API |
| Expected sales, payroll, expected profit, VAT term | Short questions to the user |
| Obligations and deadlines | Rule table maintained in this project, verified against Skatteetaten |

## Tech stack

- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL
- **Frontend:** Next.js
- **Email:** Resend
- **Hosting:** Docker, Cloudflare Tunnel

Shares its foundation (Brønnøysund integration, AI assistant, email) with [Leverandørvakt](https://leverandorvakt.devrimdev.no).

## Project structure

```
regelvakt/
  backend/   Express + TypeScript API
  web/       Next.js frontend (planned)
```

## Roadmap

### Phase 0 – Planning
- [x] Problem and demand research
- [x] Project plan and scope for the first version

### Phase 1 – Backend foundation
- [ ] Project setup (TypeScript, Express, linting, tests)
- [ ] Database setup and migrations
- [ ] Brønnøysund client

### Phase 2 – Rule engine
- [ ] Data model for obligations, rules and deadlines
- [ ] Rule table for ENK and AS
- [ ] Onboarding questions and answers
- [ ] Deadline calculation (incl. weekends and holidays)
- [ ] API: obligations for a company

### Phase 3 – Assistant
- [ ] Collect official pages into a knowledge base with source links
- [ ] Question answering with citations

### Phase 4 – Reminders
- [ ] Email reminders before deadlines

### Phase 5 – Frontend and deployment
- [ ] Next.js frontend (Norwegian and English)
- [ ] Docker and deployment

### Later
- [ ] Step-by-step help with the tax return
- [ ] Explaining official letters
- [ ] More languages

## Disclaimer

Regelvakt is a guide, not tax or accounting advice. Every answer links to its official source. For decisions with financial consequences, confirm with an accountant.
