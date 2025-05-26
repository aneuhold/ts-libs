# local-npm-registry

Functionality to manage local package installations and updates. See the main [README.md](../../README.md) for more details.

### Detailed Command Flowcharts

<details>

<summary><code>local-npm publish</code> Command Flow</summary>

```mermaid
flowchart TD
    A["local-npm publish executed"] --> B["Read package.json in current directory"]
    B --> C{"Package found?"}
    C -->|No| D["Error: No package.json found"]
    C -->|Yes| E["Extract package name and version"]
    E --> F["Check if Verdaccio is running"]
    F --> G{"Verdaccio running?"}
    G -->|No| H["Start Verdaccio server"]
    G -->|Yes| I["Generate timestamp version"]
    H --> I
    I --> J["Update package.json with timestamp version<br/>e.g., 1.2.3-20250526123456"]
    J --> K["Build package if needed"]
    K --> L["Publish to Verdaccio registry"]
    L --> M["Read local JSON store"]
    M --> N["Update package entry in store<br/>with new timestamp version"]
    N --> O["Get all subscribers for this package"]
    O --> P{"Subscribers exist?"}
    P -->|No| Q["Complete - No subscribers to update"]
    P -->|Yes| R["For each subscriber project"]
    R --> S["Update subscriber's package.json<br/>with new timestamp version"]
    S --> T["Run install command in subscriber project<br/>npm install or pnpm install"]
    T --> U{"More subscribers?"}
    U -->|Yes| R
    U -->|No| V["Complete - All subscribers updated"]
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
    C -->|Yes| F["Check if Verdaccio is running"]
    F --> G{"Verdaccio running?"}
    G -->|No| H["Start Verdaccio server"]
    G -->|Yes| I["Get package version from store"]
    H --> I
    I --> J["Re-publish package to Verdaccio<br/>with stored timestamp version"]
    J --> K["Add current project to subscribers list<br/>in local JSON store"]
    K --> L["Get all subscribers for this package"]
    L --> M["For each subscriber project<br/>including new one"]
    M --> N["Update subscriber's package.json<br/>with timestamp version"]
    N --> O["Run install command in subscriber project<br/>npm install or pnpm install"]
    O --> P{"More subscribers?"}
    P -->|Yes| M
    P -->|No| Q["Complete - All subscribers updated"]
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

## Local JSON Store Structure

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
      ]
    },
    "@aneuhold/be-ts-lib": {
      "originalVersion": "2.1.0",
      "currentVersion": "2.1.0-20250526134567",
      "subscribers": ["/path/to/consumer-project-3"]
    }
  }
}
```
