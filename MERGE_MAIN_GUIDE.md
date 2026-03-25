# Merging `main` into your feature branch and resolving conflicts

I could not run the merge in this container because the repo currently has only one local branch (`work`) and no configured remote.

Use these commands in your GitHub-backed clone (or Codespace) to merge latest `main` and resolve conflicts.

## 1) Fetch latest refs

```bash
git fetch origin
```

## 2) Ensure you are on your working branch

```bash
git checkout work
```

## 3) Merge `origin/main`

```bash
git merge origin/main
```

If there are conflicts, Git will pause the merge and list conflicted files.

## 4) Resolve conflicts (likely files in this project)

Potentially conflicted files from recent changes:
- `.github/workflows/deploy-pages.yml`
- `README.md`
- `FEATURE_ROADMAP.md`
- `index.html`
- `app.js`
- `styles.css`

Open each conflicted file and resolve sections marked with:

```text
<<<<<<< HEAD
...
=======
...
>>>>>>> origin/main
```

Keep the final intended content, then remove conflict markers.

## 5) Mark resolved and complete merge

```bash
git add .github/workflows/deploy-pages.yml README.md FEATURE_ROADMAP.md index.html app.js styles.css
git commit -m "Merge origin/main into work and resolve conflicts"
```

## 6) Push branch

```bash
git push origin work
```

## 7) Validate after merge

```bash
node --check app.js
```

If deployment workflow changed, also trigger GitHub Actions once to verify Pages deploy still works.
