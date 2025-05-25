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
    echo "  detect-changes-ci         Detect changed packages for CI (outputs to GITHUB_OUTPUT)"
    echo "  check-versions-ci <pkgs>  Check version bumps for CI (comma-separated package list)"
    echo "  detect-version-bumps-ci   Detect version bumps for publishing (outputs to GITHUB_OUTPUT)"
    echo ""
    echo "Examples:"
    echo "  $0 detect-changes"
    echo "  $0 check-versions"
    echo "  $0 bump-versions"
    echo "  $0 test-changed"
}

detect_changed_packages() {
    echo -e "${BLUE}Detecting changed packages...${NC}"
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        echo -e "${RED}Error: Not in a git repository${NC}"
        exit 1
    fi
    
    # Get the list of changed files compared to main
    if ! git show-ref --verify --quiet refs/remotes/origin/main; then
        echo -e "${YELLOW}Warning: origin/main not found, comparing to HEAD~1${NC}"
        CHANGED_FILES=$(git diff --name-only HEAD~1)
    else
        CHANGED_FILES=$(git diff --name-only origin/main...HEAD)
    fi
    
    if [ -z "$CHANGED_FILES" ]; then
        echo -e "${YELLOW}No changes detected${NC}"
        return 0
    fi
    
    echo -e "${BLUE}Changed files:${NC}"
    echo "$CHANGED_FILES" | sed 's/^/  /'
    
    # Find changed packages
    CHANGED_PACKAGES=""
    
    for file in $CHANGED_FILES; do
        if [[ $file == packages/* ]]; then
            PACKAGE_NAME=$(echo $file | cut -d'/' -f2)
            if [[ ! " $CHANGED_PACKAGES " =~ " $PACKAGE_NAME " ]]; then
                if [ -z "$CHANGED_PACKAGES" ]; then
                    CHANGED_PACKAGES="$PACKAGE_NAME"
                else
                    CHANGED_PACKAGES="$CHANGED_PACKAGES $PACKAGE_NAME"
                fi
            fi
        fi
    done
    
    if [ -z "$CHANGED_PACKAGES" ]; then
        echo -e "${YELLOW}No package changes detected${NC}"
    else
        echo -e "${GREEN}Changed packages:${NC}"
        for package in $CHANGED_PACKAGES; do
            echo -e "  ${GREEN}✓${NC} $package"
        done
    fi
    
    # Export for use by other functions
    export DETECTED_PACKAGES="$CHANGED_PACKAGES"
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
            
            # Get current version
            CURRENT_VERSION=$(node -p "require('./packages/$package/package.json').version" 2>/dev/null || echo "unknown")
            
            # Get version from main branch
            if git show-ref --verify --quiet refs/remotes/origin/main; then
                MAIN_VERSION=$(git show origin/main:packages/$package/package.json 2>/dev/null | node -p "JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).version" 2>/dev/null || echo "new")
            else
                MAIN_VERSION="unknown"
            fi
            
            echo "  Current version: $CURRENT_VERSION"
            echo "  Main version: $MAIN_VERSION"
            
            if [ "$CURRENT_VERSION" = "$MAIN_VERSION" ] && [ "$MAIN_VERSION" != "new" ]; then
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
        echo "packages=" >> $GITHUB_OUTPUT
        echo "has-changes=false" >> $GITHUB_OUTPUT
    else
        # Convert space-separated to comma-separated format for GitHub Actions
        COMMA_SEPARATED_PACKAGES=$(echo "$DETECTED_PACKAGES" | tr ' ' ',')
        echo "packages=$COMMA_SEPARATED_PACKAGES" >> $GITHUB_OUTPUT
        echo "has-changes=true" >> $GITHUB_OUTPUT
    fi
}

check_version_bumps_ci() {
    local packages_string="$1"
    IFS=',' read -ra PACKAGES <<< "$packages_string"
    FAILED_PACKAGES=""
    
    for package in "${PACKAGES[@]}"; do
        if [ -d "packages/$package" ]; then
            echo "Checking version bump for $package..."
            
            # Get current version
            CURRENT_VERSION=$(node -p "require('./packages/$package/package.json').version")
            
            # Get version from main branch
            git checkout origin/main -- "packages/$package/package.json" 2>/dev/null || {
                echo "Package $package is new, version check passed"
                continue
            }
            MAIN_VERSION=$(node -p "require('./packages/$package/package.json').version")
            
            # Restore current package.json
            git checkout HEAD -- "packages/$package/package.json"
            
            echo "Package: $package"
            echo "Main branch version: $MAIN_VERSION"
            echo "Current version: $CURRENT_VERSION"
            
            if [ "$CURRENT_VERSION" = "$MAIN_VERSION" ]; then
                echo "❌ Version not bumped for package $package"
                if [ -z "$FAILED_PACKAGES" ]; then
                    FAILED_PACKAGES="$package"
                else
                    FAILED_PACKAGES="$FAILED_PACKAGES, $package"
                fi
            else
                echo "✅ Version bumped for package $package"
            fi
        fi
    done
    
    if [ ! -z "$FAILED_PACKAGES" ]; then
        echo "❌ The following packages have changes but no version bump: $FAILED_PACKAGES"
        echo "Please bump the version in package.json for these packages before merging."
        exit 1
    else
        echo "✅ All changed packages have version bumps"
    fi
}

detect_version_bumps_ci() {
    # Get the previous commit (parent of current merge commit or previous commit)
    PREV_COMMIT=$(git rev-parse HEAD~1)
    echo "Comparing against commit: $PREV_COMMIT"
    
    PACKAGES_TO_PUBLISH=""
    HAS_PACKAGES="false"
    
    # Check each package for version changes
    for package_dir in packages/*/; do
        if [ -d "$package_dir" ]; then
            PACKAGE_NAME=$(basename "$package_dir")
            PACKAGE_JSON="$package_dir/package.json"
            
            if [ -f "$PACKAGE_JSON" ]; then
                # Get current version
                CURRENT_VERSION=$(node -p "require('./$PACKAGE_JSON').version")
                
                # Get previous version (if file existed)
                if git show "$PREV_COMMIT:$PACKAGE_JSON" >/dev/null 2>&1; then
                    PREV_VERSION=$(git show "$PREV_COMMIT:$PACKAGE_JSON" | node -p "JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).version")
                else
                    # New package
                    PREV_VERSION=""
                fi
                
                echo "Package: $PACKAGE_NAME"
                echo "Previous version: $PREV_VERSION"
                echo "Current version: $CURRENT_VERSION"
                
                if [ "$CURRENT_VERSION" != "$PREV_VERSION" ]; then
                    echo "✅ Version changed for $PACKAGE_NAME: $PREV_VERSION -> $CURRENT_VERSION"
                    if [ -z "$PACKAGES_TO_PUBLISH" ]; then
                        PACKAGES_TO_PUBLISH="$PACKAGE_NAME"
                    else
                        PACKAGES_TO_PUBLISH="$PACKAGES_TO_PUBLISH,$PACKAGE_NAME"
                    fi
                    HAS_PACKAGES="true"
                else
                    echo "➡️  No version change for $PACKAGE_NAME"
                fi
            fi
        fi
    done
    
    echo "Packages to publish: $PACKAGES_TO_PUBLISH"
    echo "packages=$PACKAGES_TO_PUBLISH" >> $GITHUB_OUTPUT
    echo "has-packages=$HAS_PACKAGES" >> $GITHUB_OUTPUT
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
