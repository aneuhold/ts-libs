---
mode: 'agent'
tools: ['changes', 'codebase', 'editFiles', 'fetch', 'findTestFiles', 'githubRepo', 'new', 'problems', 'runCommands', 'runTasks', 'search', 'searchResults', 'terminalLastCommand', 'terminalSelection', 'testFailure', 'usages', 'vscodeAPI', 'github', 'get_commit', 'get_file_contents', 'get_me', 'get_pull_request', 'get_pull_request_comments', 'get_pull_request_diff', 'get_pull_request_files', 'get_pull_request_status', 'get_tag', 'list_branches', 'list_commits', 'list_pull_requests', 'list_tags']
description: 'Updates changelogs in the mono-repo'
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
- If you have the GitHub MCP Server available, prefer to use that to see the diff in the associated pull request for the current branch. If not, you can use terminal commands.
