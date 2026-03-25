# My Son's Library (Web App)

A lightweight web app to keep records of your son's books like a personal library.

## Features implemented

- Add books with title, author, genre, reading level, status, rating, and notes.
- Search and filter by reading status.
- View quick statistics (total books, status counts, average rating).
- Delete books.
- Data persistence with browser localStorage.

## Run on GitHub (no local setup needed)

### Option 1: GitHub Pages (best for sharing)

1. Push this repo to GitHub.
2. Make sure your default branch is `main`.
3. In GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.
5. Push to `main` (or run the workflow manually in **Actions**).
6. After deploy finishes, your app will be live at:
   `https://<your-username>.github.io/<your-repo-name>/`

This repo includes `.github/workflows/deploy-pages.yml`, so deployment is automatic on every push to `main`.

### If deployment fails with "Setup Pages: Not Found"

If you see a `Get Pages site failed` / `HttpError: Not Found`, it usually means Pages has not been initialized yet for the repo.
This workflow already sets `enablement: true` in `actions/configure-pages`, which asks GitHub to enable Pages automatically on first run.
If it still fails, open **Settings → Pages** once in the GitHub UI and confirm **Source = GitHub Actions**, then rerun the workflow.

### Option 2: GitHub Codespaces (run instantly in cloud)

1. Open the repo on GitHub.
2. Switch to your feature branch (recommended before opening a PR).
3. Click **Code → Codespaces → Create codespace on current branch**.
4. In the Codespaces terminal run:
   ```bash
   python3 -m http.server 8080
   ```
5. Open forwarded port `8080` in the browser tab.

### Testing branch changes in Codespaces before opening a PR

Use this checklist to validate changes on your branch before you commit/push:

1. Create/open a Codespace on your feature branch.
2. Start the app:
   ```bash
   python3 -m http.server 8080
   ```
3. In the browser tab, verify your feature manually (example for backups):
   - Add a few books.
   - Click **Export Backup** and confirm file save/download behavior.
   - Click **Import Backup** and confirm records are restored.
4. Run automated checks from the terminal:
   ```bash
   node --check app.js
   node --test
   ```
5. Only then commit changes and open/update your PR.

## Run locally (optional)

Open `index.html` in any modern browser.

## Refined feature roadmap (based on rotation workflow)

Detailed plan: see [`FEATURE_ROADMAP.md`](FEATURE_ROADMAP.md).

Top priorities:
1. Keep: cover scanner with OCR title/author autofill.
2. Add zone-based inventory (`play_pen`, `bedroom`, `car`, `storage`).
3. Add weekly/monthly rotation cadence + on-demand rotation.
4. Track read history and favorites.
5. Recommend display sets balancing familiarity (favorites) and variety.
