# Niubiz Certification Tracker

A Next.js dashboard for tracking PAC and AP certification test cases. It provides a public read-only dashboard and a password-protected admin workflow for template imports, status updates, and in-scope changes.

## Source rules

- PAC is loaded from `Main Tracker`. Cases are in scope by default and are excluded only when explicitly marked out of scope.
- AP contains all PAC cases plus the Beneficiary and Remitter templates.
- IDs listed in `Our AP` start as `Pass`; all other AP cases start as `Not Executed Yet`.
- Imports merge on `certification + Test ID`. Existing status and in-scope choices are preserved for matching records.

The bundled dataset is generated from the approved certification workbook and AP test-case templates. No sample or dummy test cases are included.

## Stack

- Next.js 16 and React 19
- Private Vercel Blob storage for the shared dashboard dataset
- Immediate admin updates with a 30-second refresh for other viewers
- Signed, HTTP-only admin session cookie
- Vercel deployment

## Local setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create a private Blob store from the Vercel project's **Storage** tab and connect it to the project.

3. Copy `.env.example` to `.env.local` and provide all values. Keep `BLOB_READ_WRITE_TOKEN`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` server-only.

4. To seed the private store manually:

   ```bash
   pnpm storage:seed
   ```

5. Start the app:

   ```bash
   pnpm dev
   ```

The dashboard opens with the approved bundled dataset and synchronizes with the connected private Blob store. Admin changes and imports require storage to be configured.

## Environment variables

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Server only | Local access and seeding for the connected private Blob store; Vercel can use its automatically configured project credentials in production |
| `ADMIN_PASSWORD` | Server only | Shared administrator password |
| `ADMIN_SESSION_SECRET` | Server only | Signs 12-hour admin session cookies; use at least 32 random characters |

## Admin workflow

1. Select **Admin sign in** and enter the shared password.
2. Edit a test case's status or in-scope switch directly in the table.
3. Import one or more `.xlsx` or `.csv` files from **Admin controls**.
4. Review the parsed totals before applying the import.

The PAC workbook must contain `Main Tracker` and `Our AP`. AP CSVs must contain a `TEST ID` column and may use either `DESCRIPTION` or `TEST DESCRIPTION`.

## Deploy to Vercel

1. Push this directory to the target GitHub repository.
2. Import the repository in Vercel as a Next.js project.
3. Add `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` to Production and Preview environments. Connecting the Blob store supplies its Vercel credentials automatically.
4. Deploy.
5. Seed the Blob store once from a trusted local machine, or sign in as admin and apply the three supplied source templates through the dashboard.

Vercel should use the default commands: `pnpm install`, `pnpm build`, and `pnpm start`.

## Verification

```bash
pnpm build
```

Run `pnpm build` before deployment. After deployment, load the private dataset through the password-protected admin import or seed it from a trusted local machine.
