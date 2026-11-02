# Niubiz Certification Tracker

A Next.js dashboard for tracking PAC and AP certification test cases. It provides a public read-only dashboard and a password-protected admin workflow for template imports, status updates, and in-scope changes.

## Source rules

- PAC is loaded from `Main Tracker`. Cases are in scope by default and are excluded only when explicitly marked out of scope.
- AP is loaded independently from the `AP Tracker` sheet and contains the mutual, Remitter Bank, and Beneficiary Bank cases with their own status and scope.
- PAC and AP imports replace only their respective certification catalog.
- Matching PAC and AP Test IDs are marked as mutual and counted in both certifications.

The bundled dataset is generated from the approved certification workbook and AP test-case templates. No sample or dummy test cases are included.

## Stack

- Next.js 16 and React 19
- Upstash Redis for the shared dashboard dataset
- Immediate admin updates with a 60-second visible-tab refresh for other viewers
- Signed, HTTP-only admin session cookie
- Vercel deployment

## Local setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Add **Upstash for Redis** from the Vercel project's **Storage** tab and connect it to the project.

3. Copy `.env.example` to `.env.local` and provide all values. Keep the Redis credentials, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` server-only.

4. To seed the private store manually:

   ```bash
   pnpm storage:seed
   ```

5. Start the app:

   ```bash
   pnpm dev
   ```

The dashboard synchronizes with the connected Redis database. Admin changes and imports require storage to be configured.

## Environment variables

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | Server only | REST endpoint for the connected Upstash Redis database |
| `UPSTASH_REDIS_REST_TOKEN` | Server only | Authentication token for the connected Upstash Redis database |
| `ADMIN_PASSWORD` | Server only | Shared administrator password |
| `ADMIN_SESSION_SECRET` | Server only | Signs 12-hour admin session cookies; use at least 32 random characters |

## Admin workflow

1. Select **Admin sign in** and enter the shared password.
2. Edit a test case's status or in-scope switch directly in the table.
3. Import one or more `.xlsx` or `.csv` files from **Admin controls**.
4. Review the parsed totals before applying the import.

The PAC workbook must contain `Main Tracker`. The AP workbook must contain `AP Tracker`. Both require a Test ID column.

## Deploy to Vercel

1. Push this directory to the target GitHub repository.
2. Import the repository in Vercel as a Next.js project.
3. Add `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` to Production and Preview environments. Connecting Upstash supplies its Redis credentials automatically.
4. Deploy.
5. Sign in as admin and apply the PAC and AP workbooks through the dashboard. Alternatively, seed Redis once from a trusted local machine.

Vercel should use the default commands: `pnpm install`, `pnpm build`, and `pnpm start`.

## Verification

```bash
pnpm build
```

Run `pnpm build` before deployment. After deployment, load the private dataset through the password-protected admin import or seed it from a trusted local machine.
