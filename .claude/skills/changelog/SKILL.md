---
name: changelog
description: Generate an updated set of changelogs for packages in this monorepo based on the current branch as compared to main. Use when the user asks to update, generate, or write changelogs for a branch before merging.
---

Your sole task is to generate an updated set of changelogs based on the current branch as compared to main. Execute the task immediately without asking for confirmation.

For each package in the monorepo (`packages/*/CHANGELOG.md`) that has had a version bump compared to main, update the changelog file to include the changes made since the last version. Keep the updates exclusive to each package, and have them conform to the existing format in the CHANGELOG file, using the headers:

```
### ✅ Added

### 🏗️ Changed

### 🩹 Fixed

### 🔥 Removed
```

- If a header doesn't need to be used, remove it.
- For each set of bullets, try to keep them concise and easy to read. At most, there should be 7 bullets per section (Added, Changed, etc.).
- For any breaking changes, prefix it with `*Breaking Change:*`.
- Every changelog MUST have at least one non-header item listed under it.

To see the differences, run `git fetch origin main && git diff origin/main...HEAD`. If you prefer to see the diffs in a file, create the file in the root directory of the repo, then delete it when you are done.

Once you have found the changes, do not ask for confirmation — update the changelogs directly.
