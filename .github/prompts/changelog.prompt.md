---
tools: ['get_commit', 'get_file_contents', 'list_branches', 'list_commits', 'list_pull_requests', 'search_pull_requests', 'editFiles', 'search', 'runCommands', 'runTasks', 'usages', 'vscodeAPI', 'problems', 'pull_request_read']
description: 'Updates changelogs in the mono-repo'
model: Raptor mini (Preview) (copilot)
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

In order to see the differences, use the command `git fetch origin main && git diff origin/main...HEAD`. If you prefer to see the diffs in a file, then make all files in the root directory of the repo, then delete them when you are done.
