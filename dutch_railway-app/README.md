# README

Last updated: 10/15/26 2:23AM
This will be updated later. .env.example may become .env

## Project Setup (You don't need to do this)

- npx.cmd create-next-app@latest dutch_railway-app
- config:
  - Typescript? Yes
  - Linter? ESLint
  - React Compiler? No
  - TailwindCSS? Yes
  - src Directory? Yes
  - App Router? Yes
  - Cache Components? No
  - Custom import alias? No
  - AGENTS.md? Yes

## Run Project

- `npm.cmd i` (install dependencies)
- Get the `.env` values from Jack, see `.env.example`. Put it into `.env` or `.env.local`
- ???
- at the database project, `docker compose up -d`
- Profit

---

Note from @zrygan. Remove later.

Postgres uses a server-based approach. so this doesn't need to have a docker at all. We can simply run the database from dutch_railway (run docker compose up) then from -app npm run dev.

ENSURE the env with the database and -app ARE THE SAME (check discord server) copy paste that and leave it as is.

# Startup
1. in dutch_railway: `docker build` (once)
2. `docker compose up -d`
3. in dutch_railway-app: `npm.cmd run dev`