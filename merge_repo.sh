#!/bin/bash

# --- Configuration ---
# Argument 1: Absolute path to the source repository to merge
SOURCE_REPO_PATH=$1
# Argument 2: Absolute path to the target monorepo (ts-libs)
MONOREPO_PATH=$2
# Name of the temporary branch to create in the source repo
PREP_BRANCH="monorepo-prep"

# --- Basic Validation ---
if [ -z "$SOURCE_REPO_PATH" ] || [ -z "$MONOREPO_PATH" ]; then
  echo "Usage: $0 <absolute_path_to_source_repo> <absolute_path_to_monorepo>"
  echo "Example: $0 /Users/aneuhold/Development/GithubRepos/core-ts-lib /Users/aneuhold/Development/GithubRepos/ts-libs"
  exit 1
fi

if [ ! -d "$SOURCE_REPO_PATH/.git" ]; then
    echo "Error: Source path '$SOURCE_REPO_PATH' is not a valid Git repository." >&2
    exit 1
fi

if [ ! -d "$MONOREPO_PATH/.git" ]; then
    echo "Error: Monorepo path '$MONOREPO_PATH' is not a valid Git repository." >&2
    exit 1
fi

# --- Derived Variables ---
# Subdirectory name within the monorepo (e.g., "core-ts-lib")
SUBDIR_NAME=$(basename "$SOURCE_REPO_PATH")
# Target path within the monorepo (e.g., "packages/core-ts-lib")
TARGET_SUBDIR_PATH="packages/$SUBDIR_NAME"
# Temporary remote name
REMOTE_NAME="temp_${SUBDIR_NAME}"

echo "-----------------------------------------------------"
echo "Merging '$SOURCE_REPO_PATH' into '$MONOREPO_PATH/$TARGET_SUBDIR_PATH'"
echo "Using branch '$PREP_BRANCH' for preparation."
echo "-----------------------------------------------------"

# --- Step 1: Prepare Source Repo ---
echo "[1/4] Preparing source repo '$SOURCE_REPO_PATH' on branch '$PREP_BRANCH'..."
cd "$SOURCE_REPO_PATH" || exit 1

# Stash any local changes in the source repo first
STASH_MADE=false
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Stashing uncommitted changes in source repo..."
  git stash push -m "Temp stash before monorepo merge prep"
  STASH_MADE=true
fi

# Store the original branch name
ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Check if prep branch already exists
if git rev-parse --verify "$PREP_BRANCH" >/dev/null 2>&1; then
    echo "Warning: Branch '$PREP_BRANCH' already exists in '$SOURCE_REPO_PATH'. Reusing it." >&2
    git checkout "$PREP_BRANCH"
    # Optional: Reset if needed? For now, assume it's in the desired state or user wants to continue from there.
else
    git checkout -b "$PREP_BRANCH"
    if [ $? -ne 0 ]; then
      echo "Error: Failed to create branch '$PREP_BRANCH' in '$SOURCE_REPO_PATH'." >&2
      if [ "$STASH_MADE" = true ]; then git stash pop; fi
      cd - > /dev/null; exit 1;
    fi
fi

echo "Moving files to '$TARGET_SUBDIR_PATH'..."
mkdir -p "$TARGET_SUBDIR_PATH"

# Check if files are already in the target structure (idempotency)
ALREADY_STRUCTURED=true
for item in $(ls -A | grep -v '^\.git$' | grep -v "^${TARGET_SUBDIR_PATH%%/*}$"); do
  ALREADY_STRUCTURED=false
  break
done

if [ "$ALREADY_STRUCTURED" = true ] && [ -d "$TARGET_SUBDIR_PATH" ]; then
  echo "Files appear to be already structured in '$TARGET_SUBDIR_PATH'. Skipping move and commit."
else
  # Move items, handling potential errors
  MOVED_SOMETHING=false
  for item in $(ls -A | grep -v '^\.git$' | grep -v "^${TARGET_SUBDIR_PATH%%/*}$"); do
    # Check if item exists before moving
    if [ -e "$item" ]; then
      git mv "$item" "$TARGET_SUBDIR_PATH/"
      if [ $? -eq 0 ]; then
          MOVED_SOMETHING=true
      else
          echo "Warning: Failed to 'git mv $item'. It might be ignored, already moved, or cause conflicts." >&2
      fi
    else
        echo "Skipping non-existent item: $item"
    fi
  done

  # Only commit if files were actually moved
  if [ "$MOVED_SOMETHING" = true ]; then
      git commit -m "feat(monorepo): Prepare '$SUBDIR_NAME' for monorepo merge into '$TARGET_SUBDIR_PATH'"
      if [ $? -ne 0 ]; then
        echo "Error: Failed to commit preparation changes in '$SOURCE_REPO_PATH'." >&2
        echo "Attempting to reset changes..." >&2
        git reset --hard HEAD~1 # Try to undo the commit if it partially happened
        git checkout "$ORIGINAL_BRANCH"
        git branch -D "$PREP_BRANCH"
        if [ "$STASH_MADE" = true ]; then git stash pop; fi
        cd - > /dev/null; exit 1;
      fi
      echo "Preparation commit created on branch '$PREP_BRANCH'."
  else
      echo "No files found to move in the root, or files already structured. Skipping preparation commit."
  fi
fi

# Go back to the original branch in the source repo
echo "Checking out original branch '$ORIGINAL_BRANCH' in source repo."
git checkout "$ORIGINAL_BRANCH"

# Pop stash if made
if [ "$STASH_MADE" = true ]; then
  echo "Applying stashed changes back in source repo..."
  git stash pop
fi

cd - > /dev/null # Go back to original directory where script was run

# --- Step 2: Merge into Monorepo ---
echo "[2/4] Merging prepared history into monorepo '$MONOREPO_PATH'..."
cd "$MONOREPO_PATH" || exit 1

# Clean up remote if it exists from a previous failed run
git remote remove "$REMOTE_NAME" &> /dev/null

# Add the source repo as a remote using its file path
echo "Adding remote '$REMOTE_NAME' pointing to '$SOURCE_REPO_PATH'..."
git remote add "$REMOTE_NAME" "$SOURCE_REPO_PATH"
if [ $? -ne 0 ]; then echo "Error: Failed to add remote '$REMOTE_NAME'." >&2; cd - > /dev/null; exit 1; fi

# Fetch the prepared branch
echo "Fetching branch '$PREP_BRANCH' from remote '$REMOTE_NAME'..."
git fetch "$REMOTE_NAME" "$PREP_BRANCH"
if [ $? -ne 0 ]; then echo "Error: Failed to fetch branch '$PREP_BRANCH' from remote '$REMOTE_NAME'." >&2; git remote remove "$REMOTE_NAME"; cd - > /dev/null; exit 1; fi

echo "Attempting to merge remote branch '$REMOTE_NAME/$PREP_BRANCH'..."
# Perform the merge, allowing unrelated histories
# Use --no-commit to allow inspection before finalizing (as in the blog post)
git merge --allow-unrelated-histories "$REMOTE_NAME/$PREP_BRANCH" --no-commit --no-ff
MERGE_STATUS=$?

# --- Step 3: Cleanup ---
echo "[3/4] Removing temporary remote '$REMOTE_NAME'..."
git remote remove "$REMOTE_NAME"
if [ $? -ne 0 ]; then echo "Warning: Failed to remove remote '$REMOTE_NAME'." >&2; fi

# --- Step 4: Final Status ---
cd - > /dev/null # Go back to original directory

if [ $MERGE_STATUS -ne 0 ]; then
    echo "[4/4] Error: 'git merge' failed or resulted in conflicts." >&2
    echo "Automatic merge failed. Please navigate to '$MONOREPO_PATH' and resolve conflicts manually." >&2
    echo "After resolving conflicts, review the changes and run 'git commit' to finalize the merge." >&2
    echo "The prepared history is on the '$PREP_BRANCH' branch in '$SOURCE_REPO_PATH'." >&2
    exit 1
fi

echo "[4/4] Merge successful (staged)."
echo "-----------------------------------------------------"
echo "Merge complete for '$SUBDIR_NAME'. Files are staged in '$MONOREPO_PATH'."
echo "Please review the staged changes in '$MONOREPO_PATH'."
echo "If everything looks correct, run 'git commit' in '$MONOREPO_PATH' to finalize."
echo "Example commit message: feat: Merge '$SUBDIR_NAME' repository history"
echo ""
echo "Note: The branch '$PREP_BRANCH' still exists in '$SOURCE_REPO_PATH'. You may want to delete it manually after verifying the merge in the monorepo."
echo "-----------------------------------------------------"

exit 0