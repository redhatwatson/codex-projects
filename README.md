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

### Option 2: GitHub Codespaces (run instantly in cloud)

1. Open the repo on GitHub.
2. Click **Code → Codespaces → Create codespace on main**.
3. In the Codespaces terminal run:
   ```bash
   python3 -m http.server 8080
   ```
4. Open forwarded port `8080` in the browser tab.

## Run locally (optional)

Open `index.html` in any modern browser.

## Next feature ideas

1. Cover image uploads per book.
2. Reading session timer and streaks.
3. Monthly reading goals and reminders.
4. Badge/reward system for milestones.
5. Borrowed/lent book tracking.
6. CSV/JSON export-import backup.
7. Parent dashboard with reading trends.
