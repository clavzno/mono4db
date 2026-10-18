# Railway Application Deployment

**Task.** Prepare `dutch_railway-app` for Railway deployment, configure its database connection, and explain how to import the local warehouse into the Railway Postgres service.

**Tool.** OpenAI Codex ChatGPT 6.1 Sol

**Record.** Consolidated user requests and a summarized assistant answer from the deployment and database import conversation; not a verbatim transcript. Credentials are omitted. The user reported successful application deployment; successful database import was not confirmed.

## Prompt

> How can I deploy `dutch_railway-app` to Railway? I already connected Railway to a fork containing the entire `mono4db` repository, but I am unsure how to make it work with the existing Docker setup. I cannot change anything in `dutch_railway`.
>
> Tell me what to do to add `DATABASE_URL`, which Postgres service name to reference, and how to make the Dockerfile. Create the deployment files and explain the Railway settings. Help troubleshoot Railpack being selected, missing SQL files, and the missing `public` folder during the build. Keep local development working.
>
> After the application deploys, explain how to view the website and resolve the message that companies could not be loaded. What do I do to import the database into the Railway Postgres service? Explain where to find the public connection URL and how to restore the existing dump using Docker and PowerShell, including the import command on one line.

## Answer

### Dockerfile and deployment setup

The application and PostgreSQL warehouse run as separate Railway services. The application connects directly to PostgreSQL; Airflow is not required on Railway to serve reports from an imported warehouse.

The deployment work produced a multi-stage [Dockerfile](../../Dockerfile) and [.dockerignore](../../.dockerignore) at the repository root. The Dockerfile was initially inside `dutch_railway-app`, then moved to the root to support automatic detection after Railway continued using Railpack. The ignore rules were simplified to keep the app and SQL sources included by default while excluding local credentials, dependencies, data, and unrelated directories.

The container build:

- Installs the app dependencies and builds a standalone Next.js server. `BUILD_STANDALONE=true` enables this output without changing the normal local startup commands.
- Copies the existing SQL files into `/workspace/dutch_railway/qpo/queries`, preserving their location beside `/workspace/dutch_railway-app` without editing `dutch_railway`.
- Packages public assets into the standalone output when the `public` folder exists, avoiding a separate required `COPY public` step. It also includes the generated static assets.
- Runs the final server as a non-root user, listening on `0.0.0.0` and Railway's `PORT`.

The final service settings are:

| Setting | Value |
| --- | --- |
| Root Directory | Leave blank, using the repository root |
| `RAILWAY_DOCKERFILE_PATH` | `Dockerfile` |
| Explicit Dockerfile Path, if configured | `Dockerfile` |
| Custom build and start commands | Leave blank |
| App `DATABASE_URL`, for a service named `Postgres` | `${{Postgres.DATABASE_URL}}` |

The service name in the reference is the name of the PostgreSQL card on the project canvas. Save the variable, apply pending changes through the canvas's Deploy button, and deploy the latest commit from the connected fork and branch. A Dockerfile path pointing to the former `dutch_railway-app/Dockerfile` location must be updated. [Railway Dockerfiles](https://docs.railway.com/builds/dockerfiles), [reference variables](https://docs.railway.com/variables), [staged changes](https://docs.railway.com/deployments/staged-changes).

To view the site, open the app service's Settings, find Networking / Public Networking, generate a domain, and open the resulting URL. Use the listening port shown in the deployment logs if Railway asks for one. [Railway public networking](https://docs.railway.com/networking/public-networking).

### Importing the warehouse into Postgres

A successful application deployment does not copy the local Docker database. The companies endpoint reads `fact_service`, so the hosted database needs the warehouse schema and data before that request can succeed.

An existing custom-format dump was found at `dutch_railway/data/dumps/dutch_railway_db.dump`, approximately 264 MB. The import instructions were:

1. Start Docker Desktop.
2. In the Railway Postgres service, enable Public Access / TCP Proxy with target port `5432`, and apply pending changes.
3. Copy `DATABASE_PUBLIC_URL` from the Postgres service's Variables tab. The public hostname and port alone are insufficient; use the complete connection URL containing the database name and credentials.
4. Run the following commands individually in the same PowerShell session from the `mono4db` repository root, targeting the empty Railway warehouse.

Set the dump path:

```powershell
$dumpPath = (Resolve-Path ".\dutch_railway\data\dumps\dutch_railway_db.dump").Path
```

Set the import connection URL:

```powershell
$env:RAILWAY_IMPORT_URL = [System.Net.NetworkCredential]::new("", (Read-Host "Paste Railway DATABASE_PUBLIC_URL" -AsSecureString)).Password
```

Run the import:

```powershell
docker run --rm --env RAILWAY_IMPORT_URL --env PGSSLMODE=require --mount "type=bind,source=$dumpPath,target=/backup/warehouse.dump,readonly" postgres:17 sh -c 'exec pg_restore --dbname="$RAILWAY_IMPORT_URL" --no-owner --no-privileges --single-transaction --verbose /backup/warehouse.dump'
```

`RAILWAY_IMPORT_URL` is a temporary PowerShell environment variable, not a separate Railway setting. Set both variables in the same PowerShell session before running the import; otherwise the mount source or connection URL may be empty. The dump mounts read-only. `pg_restore` restores its schema, data, and indexes, skips the original ownership and grants, and uses one transaction so an error rolls back the restore. [Railway external database connections](https://docs.railway.com/databases/postgresql#connecting-externally), [PostgreSQL restore options](https://www.postgresql.org/docs/17/app-pgrestore.html).

After a successful import, confirm the warehouse tables appear under Postgres / Database, then refresh the website and retry loading companies. Keep the app connected through `${{Postgres.DATABASE_URL}}`; use the public connection URL for the import from the local computer. No database passwords or complete credential-bearing URLs belong in this prompt record.

### Verification status

The initial container image passed a production build, TypeScript checks, startup, static asset, SQL file, custom port, and API validation checks. Later packaging revisions were not rebuilt locally after the local verification request was declined. The user subsequently reported that the application deployed successfully. The database restore command was provided, but a successful restore and working hosted report queries were not confirmed in the conversation.
