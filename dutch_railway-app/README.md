# README

Last updated: 10/19/26 4:19AM

This is the accompanying web application to run and display the results of the queries. 

Postgres uses a server-based approach. so this doesn't need to have a docker at all. We can simply run the database from dutch_railway (run docker compose up) then from -app npm run dev. ENSURE the env with the database and -app ARE THE SAME (check discord server) copy paste that and leave it as is. - @zrygan

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

If it's your first time cloning the repo:
- Make sure you have the exact same .env as the one in Discord
- Run these while in dutch_railway: `docker build` (once)
- `docker compose up -d`
- Move to dutch_railway-app, and run: `npm.cmd i` (once, unless packages are updated)
- To start the app: `npm.cmd run dev`
- Open the app in your browser through localhost:3000.

If it's not your first rodeo:
- Run `docker compose up -d` in dutch_railway
- Run `npm.cmd run dev` in dutch_railway-app

## Deployed version

