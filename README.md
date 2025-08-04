
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

---

# Spend Guard

Track and manage your LLM/API usage costs across projects — lightweight, fast, and developer‑friendly.

## About

Spend Guard is a small shovel project designed for AI developers who want to avoid surprise bills. It provides a simple dashboard to:

* Add projects and providers (OpenAI, Claude, etc.)
* Paste in usage logs or connect API keys
* See spend totals and breakdowns at a glance
* Export reports for tracking or sharing

This is part of my **Phase 1 Shovel Projects**, focused on building reps in scoping, shipping, and validating small but useful tools.

## MVP Features (Phase 1.0)

* [x] Project setup (name + provider)
* [x] Manual cost logging (JSON / paste input)
* [ ] Fetch usage directly via OpenAI billing API
* [ ] Cost breakdown per project
* [ ] CSV / JSON export

## Tech Stack

* [Next.js 14](https://nextjs.org/) (App Router)
* [TypeScript](https://www.typescriptlang.org/)
* [Tailwind CSS](https://tailwindcss.com/)
* [Prisma](https://www.prisma.io/) + SQLite (local) → Postgres (prod)
* Hosting: [Vercel](https://vercel.com/)

## Getting Started

1. Clone repo:

   ```bash
   git clone https://github.com/<your-username>/spend-guard.git
   cd spend-guard
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run dev server:

   ```bash
   npm run dev
   ```

   App will be live at [http://localhost:3000](http://localhost:3000).

## Roadmap

* **Phase 1.0** → Manual logging + OpenAI API integration.
* **Phase 1.25** → Python CLI helper / mini SDK.
* **Phase 1.5** → Token Counter + Cost Alert Bot.
* **Phase 2** → Expanded developer tools (Prompt Validator, Schema Tester, Mock Server).
* **Phase 3** → Bigger SaaS experiments (Tenant SaaS Lite, Multi‑LLM Router).

## Contributing

This is a learning‑by‑shipping project. Feedback, issues, and forks are welcome!

---

## License
This project is licensed under the [MIT License](./LICENSE).
