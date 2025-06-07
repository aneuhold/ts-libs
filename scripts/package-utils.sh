#!/bin/bash

# Utility script for managing packages in the ts-libs monorepo
# This script helps with detecting changed packages and version bumps locally

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Local Commands:"
    echo "  detect-changes    Detect which packages have changed compared to main"
    echo "  check-versions    Check if changed packages have version bumps"
    echo "  bump-versions     Bump versions for all changed packages that need it (patch by default)"
    echo "  test-changed      Run tests only for changed packages"
    echo "  help              Show this help message"
    echo ""
    echo "CI Commands (used by GitHub Actions):"
    echo "  detect-changes-ci         Detect changed packages for CI (outputs JSON array to GITHUB_OUTPUT)"
    echo "  check-versions-ci <pkgs>  Check version bumps for CI (JSON array of packages)"
    echo "  detect-version-bumps-ci   Detect version bumps for publishing (outputs JSON array to GITHUB_OUTPUT)"
    echo ""
    echo "Examples:"
    echo "  $0 detect-changes"
    echo "  $0 check-versions"
    echo "  $0 bump-versions"
    echo "  $0 test-changed"
}

# Common utility functions

# Detects which packages have changes between two git references
# Usage: get_changed_packages_between <from_ref> <to_ref> [verbose]
get_changed_packages_between() {
    local from_ref="$1"
    local to_ref="$2"
    local verbose="${3:-false}"
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        echo -e "${RED}Error: Not in a git repository${NC}" >&2
        exit 1
    fi
    
    # Get the list of changed files
    local changed_files
    if [[ "$from_ref" == *"origin/main"* ]] && ! git show-ref --verify --quiet refs/remotes/origin/main; then
        [ "$verbose" = "true" ] && echo -e "${YELLOW}Warning: origin/main not found, comparing to HEAD~1${NC}" >&2
        changed_files=$(git diff --name-only HEAD~1 "$to_ref")
    elif [[ "$from_ref" == *"..."* ]]; then
        # Handle range syntax like "origin/main...HEAD"
        changed_files=$(git diff --name-only "$from_ref")
    else
        changed_files=$(git diff --name-only "$from_ref" "$to_ref")
    fi
    
    if [ -z "$changed_files" ]; then
        [ "$verbose" = "true" ] && echo -e "${YELLOW}No changes detected${NC}" >&2
        echo ""
        return 0
    fi
    
    if [ "$verbose" = "true" ]; then
        echo -e "${BLUE}Changed files:${NC}" >&2
        echo "$changed_files" | sed 's/^/  /' >&2
    fi
    
    # Find changed packages
    local changed_packages=""
    for file in $changed_files; do
        if [[ $file == packages/* ]]; then
            local package_name=$(echo "$file" | cut -d'/' -f2)
            if [ -d "packages/$package_name" ] && [[ ! " $changed_packages " =~ " $package_name " ]]; then
                if [ -z "$changed_packages" ]; then
                    changed_packages="$package_name"
                else
                    changed_packages="$changed_packages $package_name"
                fi
            fi
        fi
    done
    
    if [ "$verbose" = "true" ]; then
        if [ -z "$changed_packages" ]; then
            echo -e "${YELLOW}No package changes detected${NC}" >&2
        else
            echo -e "${GREEN}Changed packages:${NC}" >&2
            for package in $changed_packages; do
                echo -e "  ${GREEN}✓${NC} $package" >&2
            done
        fi
    fi
    
    echo "$changed_packages"
}

# Converts space-separated package list to JSON array format
packages_to_json_array() {
    local packages="$1"
    if [ -z "$packages" ]; then
        echo "[]"
    else
        echo "$packages" | awk '{
            printf "["
            for(i=1; i<=NF; i++) {
                if(i > 1) printf ","
                printf "\"%s\"", $i
            }
            printf "]"
        }'
    fi
}

# Gets the version of a package at a specific git reference
get_package_version_at_ref() {
    local package_name="$1"
    local git_ref="$2"
    local package_json="packages/$package_name/package.json"
    
    if git show "$git_ref:$package_json" >/dev/null 2>&1; then
        git show "$git_ref:$package_json" | node -p "JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).version"
    else
        echo ""  # New package
    fi
}

# Gets the current version of a package
get_current_package_version() {
    local package_name="$1"
    local package_json="packages/$package_name/package.json"
    
    if [ -f "$package_json" ]; then
        node -p "require('./$package_json').version"
    else
        echo ""
    fi
}

detect_changed_packages() {
    echo -e "${BLUE}Detecting changed packages...${NC}"
    
    local changed_packages=$(get_changed_packages_between "origin/main...HEAD" "HEAD" true)
    
    # Export for use by other functions
    export DETECTED_PACKAGES="$changed_packages"
}

check_version_bumps() {
    echo -e "${BLUE}Checking version bumps for changed packages...${NC}"
    
    if [ -z "$DETECTED_PACKAGES" ]; then
        detect_changed_packages
    fi
    
    if [ -z "$DETECTED_PACKAGES" ]; then
        echo -e "${YELLOW}No changed packages to check${NC}"
        return 0
    fi
    
    # Get packages that need version bumps
    get_packages_needing_version_bumps
    
    if [ ! -z "$PACKAGES_NEEDING_BUMPS" ]; then
        echo -e "${RED}The following packages need version bumps:${NC}"
        for package in $PACKAGES_NEEDING_BUMPS; do
            echo -e "  ${RED}✗${NC} $package"
        done
        echo -e "${YELLOW}Use: $0 bump-versions${NC}"
        exit 1
    else
        echo -e "${GREEN}All changed packages have appropriate version bumps${NC}"
    fi
}

get_packages_needing_version_bumps() {
    PACKAGES_NEEDING_BUMPS=""
    
    for package in $DETECTED_PACKAGES; do
        if [ -d "packages/$package" ]; then
            echo -e "${BLUE}Checking $package...${NC}"
            
            # Get current and main versions using utility functions
            local current_version=$(get_current_package_version "$package")
            local main_version=$(get_package_version_at_ref "$package" "origin/main")
            
            if [ -z "$main_version" ]; then
                main_version="new"
            fi
            
            echo "  Current version: $current_version"
            echo "  Main version: $main_version"
            
            if [ "$current_version" = "$main_version" ] && [ "$main_version" != "new" ]; then
                echo -e "  ${RED}❌ Version not bumped${NC}"
                if [ -z "$PACKAGES_NEEDING_BUMPS" ]; then
                    PACKAGES_NEEDING_BUMPS="$package"
                else
                    PACKAGES_NEEDING_BUMPS="$PACKAGES_NEEDING_BUMPS $package"
                fi
            else
                echo -e "  ${GREEN}✅ Version bumped or new package${NC}"
            fi
        fi
    done
}

bump_versions() {
    echo -e "${BLUE}Bumping versions for changed packages that need it...${NC}"
    
    if [ -z "$DETECTED_PACKAGES" ]; then
        detect_changed_packages
    fi
    
    if [ -z "$DETECTED_PACKAGES" ]; then
        echo -e "${YELLOW}No changed packages to check${NC}"
        return 0
    fi
    
    # Get packages that need version bumps
    get_packages_needing_version_bumps
    
    if [ -z "$PACKAGES_NEEDING_BUMPS" ]; then
        echo -e "${GREEN}All changed packages already have appropriate version bumps${NC}"
        return 0
    fi
    
    echo -e "${BLUE}The following packages will have their versions bumped:${NC}"
    for package in $PACKAGES_NEEDING_BUMPS; do
        echo -e "  ${BLUE}•${NC} $package"
    done
    
    # Prompt for confirmation
    echo -e "${YELLOW}Do you want to proceed with bumping patch versions? (y/N)${NC}"
    read -r response
    case "$response" in
        [yY][eE][sS]|[yY]) 
            ;;
        *)
            echo -e "${YELLOW}Aborted${NC}"
            return 0
            ;;
    esac
    
    # Bump versions
    for package in $PACKAGES_NEEDING_BUMPS; do
        echo -e "${BLUE}Bumping version for $package...${NC}"
        
        if command -v pnpm > /dev/null 2>&1; then
            cd "packages/$package"
            pnpm version patch --no-git-tag-version
            cd - > /dev/null
            
            NEW_VERSION=$(node -p "require('./packages/$package/package.json').version")
            echo -e "  ${GREEN}✅ Bumped to version $NEW_VERSION${NC}"
        else
            echo -e "  ${RED}❌ pnpm not found, cannot bump version${NC}"
            exit 1
        fi
    done
    
    echo -e "${GREEN}All versions bumped successfully!${NC}"
}

test_changed_packages() {
    echo -e "${BLUE}Running tests for changed packages...${NC}"
    
    if [ -z "$DETECTED_PACKAGES" ]; then
        detect_changed_packages
    fi
    
    if [ -z "$DETECTED_PACKAGES" ]; then
        echo -e "${YELLOW}No changed packages to test${NC}"
        return 0
    fi
    
    for package in $DETECTED_PACKAGES; do
        echo -e "${BLUE}Testing $package...${NC}"
        
        if ! pnpm --filter "$package" build; then
            echo -e "${RED}Build failed for $package${NC}"
            exit 1
        fi
        
        if ! pnpm --filter "$package" test; then
            echo -e "${RED}Tests failed for $package${NC}"
            exit 1
        fi
        
        if ! pnpm --filter "$package" lint; then
            echo -e "${RED}Linting failed for $package${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}✅ $package passed all checks${NC}"
    done
}

# CI-specific functions for GitHub Actions
detect_changed_packages_ci() {
    echo "Detecting changed packages for CI..."
    
    # Call the main detect_changed_packages function to do the heavy lifting
    detect_changed_packages
    
    # Convert the results to CI format
    if [ -z "$DETECTED_PACKAGES" ]; then
        echo "packages=[]" >> $GITHUB_OUTPUT
        echo "has-changes=false" >> $GITHUB_OUTPUT
    else
        # Convert to JSON array format
        local json_array=$(packages_to_json_array "$DETECTED_PACKAGES")
        echo "packages=$json_array" >> $GITHUB_OUTPUT
        echo "has-changes=true" >> $GITHUB_OUTPUT
    fi
}

check_version_bumps_ci() {
    local packages_json="$1"
    
    # Parse JSON array using node to get package list
    if [ "$packages_json" = "[]" ] || [ -z "$packages_json" ]; then
        echo "No packages to check"
        return 0
    fi
    
    echo "Checking version bumps for packages: $packages_json"
    
    # Convert JSON array to newline-separated list and store in temp file
    local temp_file=$(mktemp)
    printf '%s\n' "$packages_json" | node -e "
        let input = '';
        process.stdin.on('data', chunk => input += chunk);
        process.stdin.on('end', () => {
            try {
                const packages = JSON.parse(input.trim());
                packages.forEach(p => console.log(p));
            } catch (e) {
                console.error('Error parsing JSON:', e.message);
                process.exit(1);
            }
        });
    " > "$temp_file"
    
    local failed_packages=""
    
    # Process each package
    while IFS= read -r package; do
        [ -z "$package" ] && continue
        if [ -d "packages/$package" ]; then
            echo "Checking version bump for $package..."
            
            # Get current and main versions using utility functions
            local current_version=$(get_current_package_version "$package")
            local main_version=$(get_package_version_at_ref "$package" "origin/main")
            
            echo "Package: $package"
            echo "Main branch version: $main_version"
            echo "Current version: $current_version"
            
            if [ -z "$main_version" ]; then
                echo "Package $package is new, version check passed"
            elif [ "$current_version" = "$main_version" ]; then
                echo "❌ Version not bumped for package $package"
                if [ -z "$failed_packages" ]; then
                    failed_packages="$package"
                else
                    failed_packages="$failed_packages, $package"
                fi
            else
                echo "✅ Version bumped for package $package"
            fi
        fi
    done < "$temp_file"
    
    # Clean up temp file
    rm -f "$temp_file"
    
    if [ ! -z "$failed_packages" ]; then
        echo "❌ The following packages have changes but no version bump: $failed_packages"
        echo "Please bump the version in package.json for these packages before merging."
        exit 1
    else
        echo "✅ All changed packages have version bumps"
    fi
}

detect_version_bumps_ci() {
    # Get the previous commit (parent of current merge commit or previous commit)
    local prev_commit=$(git rev-parse HEAD~1)
    echo "Comparing against commit: $prev_commit"
    
    # First, detect which packages have actual changes (not just version bumps)
    echo "Detecting packages with changes..."
    local changed_packages=$(get_changed_packages_between "$prev_commit" "HEAD" true)
    
    if [ -z "$changed_packages" ]; then
        echo "No package changes detected"
        echo "packages=[]" >> $GITHUB_OUTPUT
        echo "has-packages=false" >> $GITHUB_OUTPUT
        return 0
    fi
    
    echo "Changed packages: $changed_packages"
    
    local packages_to_publish=""
    local has_packages="false"
    
    # Check only changed packages for version changes
    for package_name in $changed_packages; do
        local package_json="packages/$package_name/package.json"
        
        if [ -f "$package_json" ]; then
            # Get current and previous versions using utility functions
            local current_version=$(get_current_package_version "$package_name")
            local prev_version=$(get_package_version_at_ref "$package_name" "$prev_commit")
            
            echo "Package: $package_name"
            echo "Previous version: $prev_version"
            echo "Current version: $current_version"
            
            if [ "$current_version" != "$prev_version" ]; then
                echo "✅ Version changed for $package_name: $prev_version -> $current_version"
                if [ -z "$packages_to_publish" ]; then
                    packages_to_publish="$package_name"
                else
                    packages_to_publish="$packages_to_publish $package_name"
                fi
                has_packages="true"
            else
                echo "⚠️  Package $package_name has changes but no version bump - skipping publish"
            fi
        fi
    done
    
    echo "Packages to publish: $packages_to_publish"
    
    # Convert to JSON array format and output to GitHub Actions
    local json_array=$(packages_to_json_array "$packages_to_publish")
    echo "packages=$json_array" >> $GITHUB_OUTPUT
    echo "has-packages=$has_packages" >> $GITHUB_OUTPUT
}

# Main script logic
case "${1:-help}" in
    "detect-changes")
        detect_changed_packages
        ;;
    "check-versions")
        check_version_bumps
        ;;
    "bump-versions")
        bump_versions
        ;;
    "test-changed")
        test_changed_packages
        ;;
    "detect-changes-ci")
        detect_changed_packages_ci
        ;;
    "check-versions-ci")
        check_version_bumps_ci "$2"
        ;;
    "detect-version-bumps-ci")
        detect_version_bumps_ci
        ;;
    "help")
        print_usage
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        print_usage
        exit 1
        ;;
esac
