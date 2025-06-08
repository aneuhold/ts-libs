# local-npm-registry

[![JSR](https://jsr.io/badges/@aneuhold/local-npm-registry)](https://jsr.io/@aneuhold/local-npm-registry)
[![NPM](https://img.shields.io/npm/v/%40aneuhold%2Flocal-npm-registry)](https://www.npmjs.com/package/@aneuhold/local-npm-registry)
[![License](https://img.shields.io/github/license/aneuhold/ts-libs)](https://github.com/aneuhold/ts-libs/blob/main/LICENSE)

🚀 **Supercharge your local development workflow!** This CLI tool manages local npm package installations as if they were published, making it effortless to test changes across multiple projects without the hassle of publishing to npm or linking packages manually.

## 📦 Installation

Install as a dev dependency in both your library and consuming projects:

```bash
npm install -D @aneuhold/local-npm-registry
# or
pnpm add -D @aneuhold/local-npm-registry
```

## 🎯 Quick Start

### 1. Set up your library project for development

In your library project (the one you want to test changes from), set up a watch command using nodemon:

```json
{
  "scripts": {
    "dev": "nodemon --ignore lib/ -e ts --exec \"npm run build && local-npm publish\""
  }
}
```

Now when you run `npm run dev`, every time you save a TypeScript file, your library will rebuild and automatically update all consuming projects!

### 2. Subscribe your frontend project to the library

In your frontend/consuming project, first install the tool as a dev dependency, then add a convenient script:

```json
{
  "scripts": {
    "sub:my-library": "local-npm subscribe @my-org/my-library",
    "unsub:my-library": "local-npm unsubscribe @my-org/my-library"
  }
}
```

Then subscribe to your library:

```bash
cd my-frontend-project
npm run sub:my-library
```

That's it! Your frontend project will now automatically receive updates whenever you make changes to your library.

## 🛠️ Core Commands

### `local-npm publish`

📤 **Publishes your current package** and automatically updates all projects that are subscribed to it.

- Creates a timestamped version (e.g., `1.2.3-20250528123456`)
- Updates all subscriber projects with the new version
- Perfect for the watch command in your library

### `local-npm subscribe <package-name>`

🔔 **Subscribe to a package** to receive automatic updates when it's published locally.

- Adds your current project as a subscriber
- Installs the latest local version immediately
- Great for frontend projects consuming your libraries

### `local-npm unpublish [package-name]`

🗑️ **Removes a package** from the local registry and resets all subscribers to original versions.

- Cleans up when you're done testing
- Resets all consuming projects back to their original package versions

### `local-npm unsubscribe [package-name]`

🔕 **Unsubscribe from packages** and reset to original versions.

- Remove subscription from one package or all packages (if no name provided)
- Resets your project back to the original package versions

## 💡 Why Use This?

✅ **No more `npm link` headaches** - Works reliably across different package managers  
✅ **Automatic updates** - Changes propagate instantly to all consuming projects  
✅ **Clean workflow** - Easy to set up and tear down  
✅ **Version safety** - Always keeps track of original versions to restore  
✅ **Multiple subscribers** - One library can update many consuming projects at once  
✅ **True package installation behavior** - Unlike [local file paths](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#local-paths), this tool installs packages the same way as remote registries, ensuring your local testing matches production behavior

## 🔧 Additional Commands

- `local-npm list` - See all packages in your local registry and their subscribers
- `local-npm get-store` - View the raw local package store data
- `local-npm config` - Show current configuration
- `local-npm init-config` - Create a configuration file
- `local-npm clear-store` - Reset everything and start fresh

## 📋 Technical Details

### How It Works

This tool uses Verdaccio (a private npm registry) under the hood to simulate publishing packages locally. It maintains a JSON store that tracks package versions and subscriber relationships, ensuring clean workflows and easy cleanup.

> **Note:** Verdaccio is only started for commands that need to publish packages (`publish` and `subscribe`). The `unpublish` and `unsubscribe` commands only modify package.json files and the local store, so they don't require Verdaccio to be running necessarily.

### Why Not Use Local File Paths?

While npm supports [local file paths](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#local-paths) as dependencies (e.g., `"my-package": "file:../my-package"`), this approach has significant limitations:

- **Different installation behavior**: Local paths don't install the package the same way as remote registries do
- **Missing dependency resolution**: The local package's own dependencies aren't automatically installed in the consuming project
- **No build processes**: Pre-publish scripts and build steps are often skipped
- **Inconsistent testing**: Your local testing environment differs from how the package will actually be consumed in production

This tool solves these issues by using a real npm registry (Verdaccio) locally, ensuring that packages are installed, built, and resolved exactly as they would be when published to the public npm registry.

<details>

<summary><code>local-npm publish</code> Command Flow</summary>

```mermaid
flowchart TD
    A["local-npm publish executed"] --> B["Read package.json in current directory"]
    B --> C{"Package found?"}
    C -->|No| D["Error: No package.json found"]
    C -->|Yes| E["Extract package name and version"]
    E --> F["Start Verdaccio server"]
    F --> G["Generate timestamp version"]
    G --> H["Update package.json with timestamp version<br/>e.g., 1.2.3-20250526123456"]
    H --> I["Build package if needed"]
    I --> J["Publish to Verdaccio registry"]
    J --> K["Read local JSON store"]
    K --> L["Update package entry in store<br/>with new timestamp version"]
    L --> M["Get all subscribers for this package"]
    M --> N{"Subscribers exist?"}
    N -->|No| O["Shut down Verdaccio server"]
    N -->|Yes| P["For each subscriber project"]
    P --> Q["Update subscriber's package.json<br/>with new timestamp version"]
    Q --> R["Run install command in subscriber project<br/>npm install or pnpm install"]
    R --> S{"More subscribers?"}
    S -->|Yes| P
    S -->|No| T["Shut down Verdaccio server"]
    O --> U["Complete - No subscribers to update"]
    T --> V["Complete - All subscribers updated"]
```

</details>

<details>

<summary><code>local-npm subscribe <package-name></code> Command Flow</summary>

```mermaid
flowchart TD
    A["local-npm subscribe &lt;package-name&gt; executed"] --> B["Read local JSON store"]
    B --> C{"Package exists in store?"}
    C -->|No| D["List available packages from store"]
    D --> E["Error: Package not found"]
    C -->|Yes| F["Start Verdaccio server"]
    F --> G["Get package version from store"]
    G --> H["Re-publish package to Verdaccio<br/>with stored timestamp version"]
    H --> I["Add current project to subscribers list<br/>in local JSON store"]
    I --> J["Get all subscribers for this package"]
    J --> K["For each subscriber project<br/>including new one"]
    K --> L["Update subscriber's package.json<br/>with timestamp version"]
    L --> M["Run install command in subscriber project<br/>npm install or pnpm install"]
    M --> N{"More subscribers?"}
    N -->|Yes| K
    N -->|No| O["Shut down Verdaccio server"]
    O --> P["Complete - All subscribers updated"]
```

</details>

<details>

<summary><code>local-npm unpublish &lt;package-name&gt;</code> Command Flow</summary>

```mermaid
flowchart TD
    A["local-npm unpublish executed"] --> B["Read package.json in current directory"]
    B --> C{"Package found?"}
    C -->|No| D["Error: No package.json found"]
    C -->|Yes| E["Extract package name"]
    E --> F["Read local JSON store"]
    F --> G{"Package exists in store?"}
    G -->|No| H["Error: Package not in local registry"]
    G -->|Yes| I["Get original version from store"]
    I --> J["Get all subscribers for this package"]
    J --> K{"Subscribers exist?"}
    K -->|Yes| L["For each subscriber project"]
    K -->|No| M["Reset current package.json<br/>to original version"]
    L --> N["Update subscriber's package.json<br/>to original version without timestamp"]
    N --> O["Run install command in subscriber project<br/>npm install or pnpm install"]
    O --> P{"More subscribers?"}
    P -->|Yes| L
    P -->|No| M
    M --> Q["Remove package entry from local JSON store"]
    Q --> R["Complete - Package unpublished<br/>and all subscribers reset"]
```

</details>
<details>

<summary><code>local-npm unsubscribe [&lt;package-name&gt;]</code> Command Flow</summary>

```mermaid
flowchart TD
    A["local-npm unsubscribe &#91;&lt;package-name&gt;&#93; executed"] --> B{"Package name provided?"}
    B -->|No| C["Read local JSON store"]
    B -->|Yes| D["Read local JSON store"]
    C --> E["Find all packages where current project<br/>is a subscriber"]
    D --> F{"Package exists in store?"}
    F -->|No| G["Error: Package not found in store"]
    E --> H{"Any subscribed packages?"}
    H -->|No| I["No packages to unsubscribe from"]
    H -->|Yes| J["For each subscribed package"]
    F -->|Yes| K["Check if current project is subscriber"]
    K --> L{"Current project subscribed?"}
    L -->|No| M["Error: Not subscribed to this package"]
    L -->|Yes| N["Remove current project from<br/>package's subscribers list"]
    J --> O["Get original version for package"]
    O --> P["Update current project's package.json<br/>to original version without timestamp"]
    P --> Q["Remove current project from<br/>package's subscribers list"]
    Q --> R{"More packages to process?"}
    R -->|Yes| J
    R -->|No| S["Run install command in current project<br/>npm install or pnpm install"]
    N --> T["Get original version for package"]
    T --> U["Update current project's package.json<br/>to original version without timestamp"]
    U --> V["Run install command in current project<br/>npm install or pnpm install"]
    S --> W["Complete - Unsubscribed from all packages"]
    V --> X["Complete - Unsubscribed from package"]
```

</details>

### Local JSON Store Structure

The local JSON store maintains the following structure:

```json
{
  "packages": {
    "@aneuhold/core-ts-lib": {
      "originalVersion": "1.2.3",
      "currentVersion": "1.2.3-20250526123456",
      "subscribers": [
        "/path/to/consumer-project-1",
        "/path/to/consumer-project-2"
      ],
      "packageRootPath": "/path/to/core-ts-lib"
    },
    "@aneuhold/be-ts-lib": {
      "originalVersion": "2.1.0",
      "currentVersion": "2.1.0-20250526134567",
      "subscribers": ["/path/to/consumer-project-3"],
      "packageRootPath": "/path/to/be-ts-lib"
    }
  }
}
```
