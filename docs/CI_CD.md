# CI/CD

GitHub Actions checks every push, and deploys only commits that passed CI. `main` is the one branch: commit and push
straight to it. Deploys are started by hand, by typing `deploy`.

```
Push to main ──► CI ───────────────────────────────────────────┐
               ├ Frontend: ESLint, types, Vitest, build        │  all green
               ├ Backend: ruff, import boundaries, pytest,      ├──► "CI passed"
               │          contract schemas                     │
               ├ Integration + e2e: real Supabase, the         │
               │          integration tests,                   │
               │          two users in Chrome (2 policy sets)  │
               └ Image: build the Docker image, smoke-run it   ┘

By hand ──► Deploy (type "deploy") ──► refuses unless CI passed on the newest commit on main
                                       ──► migrations → Render exact commit → wait until live → smoke test

Push       ──► Security: CodeQL, gitleaks, npm/pip audit, Trivy image scan ──► "Security passed"   (also weekly)
Nightly    ──► Live model check (real Gemini) ──► opens an issue when it fails, closes it when it passes
Weekly     ──► Dependabot PRs into main (releases at least 14 days old)
```

## Workflows

| File | Runs on | What it does |
|---|---|---|
| `.github/workflows/ci.yml` | every push to `main`; PRs; by hand | All checks below. The gate job **CI passed** is the result Deploy checks. Never deploys. |
| `.github/workflows/deploy.yml` | by hand only (Actions → Deploy → Run workflow, type `deploy`) | Deploys the newest commit on `main` to one environment, if CI passed on it. |
| `.github/workflows/security.yml` | every PR; pushes; Mondays 06:17 UTC; by hand | Security checks. Gate job: **Security passed**. |
| `.github/workflows/llm-check.yml` | daily 13:23 UTC; by hand | `npm run llm:check -- --all` against the real models. |
| `.github/workflows/keep-awake.yml` | every 10 min, 7am-midnight Arizona; by hand | Pings production so the free Render service doesn't sleep. Never fails. Production only, to stay inside the 750 free hours. |
| `.github/dependabot.yml` | weekly | Update PRs for npm, pip, Actions and the Docker base images. |

### CI jobs (run in parallel)
- **Frontend**
  - `npm run lint` (ESLint: TypeScript's recommended rules and the rules of hooks; no style rules)
  - `tsc` for the app and the e2e script
  - Vitest, including the copy rules
  - a production build
- **Backend**
  - `ruff check` (correctness rules only; no formatter, so code keeps its layout)
  - import-linter (module boundaries)
  - pytest without the integration folder
  - checks that `contracts/schemas` matches the code (run `npm run schemas` and commit if not)
- **Integration + e2e**
  - Starts local Supabase in the runner (`scripts/ci/start-supabase.sh`), which applies every migration to a fresh database. Studio, realtime and logging are skipped to save time; start-up is retried up to 3 times.
  - Lints the schema (`supabase db lint`).
  - Runs the integration tests with `REQUIRE_SUPABASE=1`, so a database that didn't start **fails** the run instead of skipping it.
  - Runs `e2e/full-loop.ts` twice, through `scripts/ci/run-e2e.sh`: once with the defaults, and once with the module owners' original choices (`BUDDY_DISCOVERY=search SURVEY_SCREENS=on MOVE_TAGS_SOURCE=user ONBOARDING_REQUIRED=false OPPORTUNITY_CHIP=events_pro`). The script refuses a port that's already in use, and checks that the settings really took effect before testing.
  - When it fails, screenshots and server logs are uploaded as the `e2e-artifacts` artifact (kept 7 days).
- **Image**
  - Builds the production Dockerfile and runs it the way Render does.
  - `scripts/ci/wait-for-deploy.sh` then checks `/health` reports the commit, the app page loads, `/config` answers, `/me` is 401 signed out, and the API docs are off.

### Deploy (`deploy.yml`)
1. **Ready to deploy?** Before any secret is loaded, it checks that you typed `deploy`, that it was started from
   `main`, and that **CI passed** on that commit. It refuses if CI failed, was cancelled, or is still running.
2. Checks the environment has all its settings, and names any that are missing.
3. Lists, then applies, pending migrations to that environment's Supabase project (`supabase db push --remote=<ref> --skip-vault`). If a migration fails, the deploy stops before the app changes.
4. Calls the Render deploy hook with `&ref=<commit>`, so Render builds exactly the commit that passed. Render's own auto-deploy is off (`render.yaml`).
5. Waits, for up to 30 minutes, until `/api/v1/health` reports that commit (Render sets `RENDER_GIT_COMMIT`). Then it runs the same smoke checks as the Image job.
6. Only one deploy per environment runs at a time; a second one waits for the first to finish.

If a new version fails Render's health check, Render keeps serving the previous one. The deploy job then times out at step 5 and fails, which shows up in Actions.

### Audit levels
- **Packages that ship** (npm `--omit=dev`, `backend/requirements.txt`, the image) fail on moderate or worse. For pip and the image, any known vulnerability with a fix available fails.
- **Build and test tools** (npm dev dependencies) fail on high or worse. The current ESLint toolchain has one moderate advisory (`minimatch`, GHSA-g3hv-75wg-m249). It is dev-only, and its fixed versions are too new to adopt yet.
- **Image scan (Trivy)** fails on HIGH or CRITICAL issues that have a fix. The Dockerfile applies Debian security updates and removes pip from the final image.
- **To accept a finding:** add it to `.trivyignore` with a reason and a review date, or fix it with a dependency bump.

## One-time setup
Already done on GitHub: `main` is the default branch; the `production` environment exists (deploys from `main` only;
`staging` exists too, empty and unused until staging is set up); the `main` ruleset blocks force pushes and deleting
`main`, and nothing else; Dependabot alerts, secret scanning and push protection are on.

Who can deploy: anyone with write access to the repository (**Settings** → **Collaborators** → **Add people**).

Still to do:
1. Supabase, Render and the `production` environment values: follow [DEPLOY.md](DEPLOY.md), "First deploy, in order".
2. For the nightly model check: on github.com, the repository → **Settings** → **Secrets and variables** → **Actions**
   → **Repository secrets** → **New repository secret** (a repository secret, not an environment one), name `GEMINI_API_KEY`, value from aistudio.google.com/apikey.

## Day to day
- **Making a change:**
  1. `git pull` to get the newest `main`.
  2. Commit, then `git push`. (Running `npm run lint && npm test` first saves a round trip, but CI runs them anyway.)
  3. On github.com, **Actions** → **CI**: wait for your commit's run to go green (about 10 minutes). If it fails, open
     it, read the failing step, fix, and push again.
- **Deploying:**
  1. **Actions** → **Deploy** (left list) → **Run workflow** (right).
  2. Leave **Use workflow from** as `main`, type `deploy` in the confirm box, leave the environment as `production`.
  3. Click the green **Run workflow**. Open the run to watch it; it ends when the new version is live.
  4. "CI is still running" or "CI did not pass" means wait for, or fix, CI on the newest commit, then run Deploy again.
  5. If two people push at about the same time, Deploy deploys whatever is newest on `main` when you start it.
- **To reproduce the CI e2e:**
  1. Build with `npm run build`.
  2. Run `scripts/ci/run-e2e.sh default`.
  3. Run it again with policies, e.g. `scripts/ci/run-e2e.sh originals BUDDY_DISCOVERY=search`.

  It uses port 8000 unless you set `E2E_PORT` (also allowed: 4173 and 5173), and refuses a port already in use.
- **When an e2e run fails in CI:** download `e2e-artifacts` from the run's summary page. It has a screenshot of each page at the point of failure and the server log.
- **Redeploy or roll back:**
  - **Instant:** Render → service → Deploys → Rollback on an earlier deploy.
  - **Through the pipeline:** `git revert <bad commit>`, push, wait for CI, then run Deploy. Deploy only deploys the
    newest commit on `main`, so going back means a new commit that undoes the bad one.
  - Migrations only move forward. Write them so the previous app version still works (add columns before using them; drop them in a later release).
- **Model check issue:** when the `llm-check` issue opens, run `npm run llm:check -- --all` locally to see which models answer. Pin working ones with `GEMINI_MODELS` on Render if needed. The issue closes itself on the next passing run.
- **Updating a pinned Action or tool:** Actions are pinned to full commit SHAs, with the version in a comment, and Dependabot proposes updates. The Supabase CLI version is pinned in `ci.yml` and `deploy.yml` (`3.0.0`); keep it in step with what the team runs locally.
