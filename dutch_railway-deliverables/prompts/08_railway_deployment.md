# Railway Application Deployment

**Task.** Prepare `dutch_railway-app` for Railway deployment while preserving its SQL file dependencies and the existing local setup.

**Tool.** OpenAI Codex ChatGPT 6.1 Sol

**Record.** Consolidated deployment request and implementation requirements, rather than a verbatim conversation transcript or confirmation of a completed Railway deployment.

## Prompt

> Help deploy `dutch_railway-app` to Railway. The Railway service is already connected to a fork of this repository. Inspect how the application starts, connects to PostgreSQL, and loads its SQL files, then create the required deployment files. Do not modify anything in `dutch_railway`.
>
> - Add an application-specific Dockerfile inside `dutch_railway-app`, using the repository root as the build context. Include the existing files in `dutch_railway/qpo/queries` without changing them, and preserve their location relative to the application.
> - Build a standalone Next.js server for the container. Keep the existing local development, build, and startup commands working. Include the public and generated static assets in the final image.
> - Add a Dockerfile-specific ignore file to exclude local environment files, installed dependencies, build output, and unrelated repository directories.
> - Run the application as a non-root user, listening on `0.0.0.0` and Railway's supplied `PORT`. Keep database credentials out of the image and read `DATABASE_URL` at runtime.
> - Document the Railway settings: leave Root Directory unset, set `RAILWAY_DOCKERFILE_PATH` to `dutch_railway-app/Dockerfile`, and leave build and start command overrides unset.
> - Explain how to add a separate PostgreSQL service, reference its `DATABASE_URL`, and import a copy of the existing warehouse. Clarify that deploying from GitHub does not transfer the local Docker database or its data, and that Airflow does not need to run on Railway to serve the imported reports.
>
> Build the image and verify TypeScript, container startup, static assets, required SQL files, custom port handling, and API input validation. Confirm that local credentials are absent from the image and that `dutch_railway` remains unchanged. Distinguish these checks from live report queries, which require the hosted warehouse to be configured and populated.
