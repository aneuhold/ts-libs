---
mode: 'agent'
tools: ['codebase', 'usages', 'vscodeAPI', 'problems', 'searchResults', 'editFiles', 'search', 'runTasks', 'activePullRequest']
description: 'Updates changelogs in the mono-repo'
model: GPT-4.1
---

For each package in the mono-repo (`packages/*/CHANGELOG.md`) that has had a version bump compared to main, update the changelog file to include the changes made since the last version. Keep the updates exclusive to each package, and have them conform to the existing format in the CHANGELOG file, using the headers:

```
### ✅ Added

### 🏗️ Changed

### 🩹 Fixed

### 🔥 Removed
```

- If a header doesn't need to be used, remove it. 
- For each set of bullets, try to keep them concise and easy to read. At most, there should be 7 bullets per section (Added, Changed, etc.).
- For any breaking changes, prefix it with `*Breaking Change:*`.
- In order to see the differences, use the GitHub Pull Request VS Code Extension.
