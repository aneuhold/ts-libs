---
mode: 'agent'
tools: ['changes', 'codebase', 'editFiles', 'fetch', 'findTestFiles', 'githubRepo', 'new', 'problems', 'runCommands', 'runTasks', 'search', 'searchResults', 'terminalLastCommand', 'terminalSelection', 'testFailure', 'usages', 'vscodeAPI']
description: 'Updates changelogs in the mono-repo'
---

For each package in the mono-repo (`packages/*/CHANGELOG.md`) that has had a version bump compared to main, update the changelog file to include the changes made since the last version. Keep the updates exclusive to each package, and have them conform to the existing format in the CHANGELOG file, using the headers:

```
### ✅ Added

### 🏗️ Changed

### 🩹 Fixed

### 🔥 Removed
```

If a header doesn't need to be used, remove it. For each set of bullets, try to keep them concise and easy to read. At most, there should be 7 bullets per section (Added, Changed, etc.)

In order to do this efficiently, use the `get_changed_files` tool. Avoid requesting terminal commands to be ran. Try to only use the tools you have available that don't need approval.
