# Deploy on Railway

Deploy this application and a PostgreSQL database as separate services in the same Railway project and environment. The app reads the existing SQL files from `dutch_railway/qpo/queries`; the image preserves that folder beside the app. No changes to `dutch_railway` or its Docker Compose setup are required.

## Application service

Push the deployment files to the fork and branch connected to your Railway service. Configure the service as follows:

| Setting | Value |
| --- | --- |
| Root Directory | Leave unset so the build uses the repository root |
| Variable: `RAILWAY_DOCKERFILE_PATH` | Remove the old nested path; the root `Dockerfile` is detected automatically |
| Build command override | Leave unset |
| Start command override | Leave unset |
| Variable: `DATABASE_URL` | Reference the PostgreSQL service's `DATABASE_URL` |

The deployment `Dockerfile` and `.dockerignore` are at the repository root. This lets Railway detect Docker directly. If the service exposes an explicit Dockerfile Path setting, set it to `Dockerfile`. Apply pending settings changes before deploying the latest commit. The build log should say `Using detected Dockerfile!` and show the `/workspace/dutch_railway-app` working directory.

If the database service is named `Postgres`, the app variable is:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

Use Railway's variable picker if the database service has another name. Keep this variable server-side; do not name it `NEXT_PUBLIC_DATABASE_URL` or commit credentials to Git.

The image builds a standalone Next.js server and runs it as a non-root user. It listens on `0.0.0.0` and reads Railway's `PORT`, with 3000 as the default. Local `npm.cmd run dev`, `npm.cmd run build`, and `npm.cmd start` retain their existing behavior because standalone output is enabled only when `BUILD_STANDALONE=true` during the container build.

The root `.dockerignore` excludes local environment files, installed dependencies, build output, and unrelated repository directories. Application and SQL sources remain included by default. The build does not need database credentials. Railway must allow outbound access to the package registry and Google Fonts during the build.

## Warehouse database

1. Add PostgreSQL to the same Railway project and environment. Check its version against the local warehouse, which uses PostgreSQL 17.
2. Export the populated local warehouse and restore that export into the hosted database, including its schema, data, and indexes. Adapt local ownership and grants for the hosted database account during the transfer.
3. Set the app's `DATABASE_URL` reference and redeploy the app.

GitHub deployment does not transfer a local Docker volume or database dump. A newly created PostgreSQL service is empty until you import the warehouse. Airflow does not need to run on Railway to serve reports from an imported warehouse. Later warehouse changes require another data transfer or a separately configured pipeline.

Do not use `localhost:5433` or `dutch_railway_db:5432` in Railway. Those addresses belong to the local setup. Use the hosted database's public connection details for an import from your computer, and its private connection URL for the deployed app.

## Verify the deployment

1. Generate a public domain in the app service's Networking settings. Use the port the app logs show, normally Railway's supplied `PORT`.
2. Open `/api/companies` on that domain and confirm that it returns company names.
3. Run all four reports, then check CSV and PDF exports.

An HTTP 503 from a report or company endpoint means the backend could not complete its work. Check deployment logs, the database connection, and the imported tables. If a build cannot find `/dutch_railway/qpo/queries/dashboard/companies.sql`, inspect the beginning of the full build log. The root Dockerfile places that file at `/workspace/dutch_railway/qpo/queries/dashboard/companies.sql`; a different path indicates a different build layout. Confirm Root Directory is unset, the deployment uses the latest commit containing the root Dockerfile, and no nested Dockerfile path or build/start command override remains.

## Build and run locally

Run these commands from the repository root in PowerShell:

```powershell
docker build -t dutch-railway-app .
docker run --rm -p 3001:3000 --env-file dutch_railway-app/.env dutch-railway-app
```

The environment file must use a database address reachable from the container. For the local database exposed by Docker Desktop on port 5433, use `host.docker.internal:5433` as the host and port in `DATABASE_URL`. Keep the matching database name and credentials. Open `http://localhost:3001`.

## References

- [Railway Dockerfiles](https://docs.railway.com/builds/dockerfiles)
- [Railway monorepos](https://docs.railway.com/deployments/monorepo)
- [Railway variables](https://docs.railway.com/variables)
- [Railway PostgreSQL](https://docs.railway.com/databases/postgresql)
- [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [Docker build contexts and ignore files](https://docs.docker.com/build/concepts/context/)
