# local-npm-registry

<!--JSR is specifically using an escape character for @ in the URL because only 1 package is published to JSR, where NPM is published to two locations-->

[![JSR](https://img.shields.io/jsr/v/%40aneuhold/local-npm-registry?logo=jsr&label=JSR)](https://jsr.io/%40aneuhold/local-npm-registry)
[![NPM](https://img.shields.io/npm/v/%40aneuhold%2Flocal-npm-registry?logo=npm&label=NPM)](https://www.npmjs.com/package/@aneuhold/local-npm-registry)
[![License](https://img.shields.io/github/license/aneuhold/ts-libs)](https://github.com/aneuhold/ts-libs/blob/main/LICENSE)

<div align="center">
  <picture>
    <img alt="local-npm-registry logo" src="https://i.imgur.com/94XsnCg.png" height="200">
  </picture>
</div>

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

> **💡 Pro tip:** You can pass any [npm publish options](https://docs.npmjs.com/cli/v11/using-npm/config#shorthands-and-other-cli-niceties) to `local-npm publish`. For example, use `local-npm publish --ignore-scripts` if you want to skip pre/post-publish scripts.

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

### `local-npm publish [npm-publish-options]`

📤 **Publishes your current package** and automatically updates all projects that are subscribed to it.

- Creates a version carrying the publishing directory and the moment it was published (e.g.,
  `1.2.3-pa1b2c3d4.20250528123456789`)
- Updates all subscriber projects with the new version
- Perfect for the watch command in your library
- Supports all npm publish options: Pass any [npm publish options](https://docs.npmjs.com/cli/v11/using-npm/config#shorthands-and-other-cli-niceties) directly to the underlying `npm publish` command

<details>
<summary><strong>Examples</strong></summary>

```bash
# Basic publish
local-npm publish

# Publish without running scripts
local-npm publish --ignore-scripts

# Publish with verbose output for debugging
local-npm publish --verbose
```

</details>

### `local-npm subscribe <package-name> [--path <path>]`

🔔 **Subscribe to a package** to receive automatic updates when it's published locally.

- Adds your current project as a subscriber
- Installs the latest local version immediately
- Preserves publish arguments: Uses the same npm publish options as the package's most recent publish
- Use `--path` to pick which directory to subscribe to when a package is published from several
- Great for frontend projects consuming your libraries

### `local-npm unpublish [package-name] [--path <path>] [--all-paths]`

🗑️ **Removes a package** from the local registry and resets all subscribers to original versions.

- Cleans up when you're done testing
- Resets all subscribers back to their original package versions
- Removes only what the target directory published, leaving other directories alone
- Defaults to the current directory, or to the only one publishing the package. Use `--path` to pick
  one of several, or `--all-paths` for every one

### `local-npm unsubscribe [package-name]`

🔕 **Unsubscribe from packages** and reset to original versions.

- Remove subscription from one package or all packages (if no name provided)
- Resets your project back to the original package versions
- Leaves any subscriptions you keep working as they were

## 💡 Why Use This?

✅ **No more `npm link` headaches** - Works reliably across different package managers  
✅ **Automatic updates** - Changes propagate instantly to all consuming projects  
✅ **Clean workflow** - Easy to set up and tear down  
✅ **Version safety** - Always keeps track of original versions to restore  
✅ **Multiple subscribers** - One library can update many consuming projects at once  
✅ **True package installation behavior** - Unlike [local file paths](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#local-paths), this tool installs packages the same way as remote registries, ensuring your local testing matches production behavior

## 🔧 Additional Commands

- `local-npm prune` - Drop packages whose publishing directory is gone and reset their subscribers.
- `local-npm list` - See all packages in your local registry and their subscribers
- `local-npm get-store` - View the raw local package store data
- `local-npm config` - Show current configuration
- `local-npm init-config` - Create a configuration file
- `local-npm clear-store` - Reset everything and start fresh, emptying the registry's storage

## ⚙️ Configuration

The tool can be configured using a `.local-npm-registry.json` file. The configuration file is searched starting from the current working directory and traversing up the directory tree until found.

<details>
<summary><strong>Configuration File Structure</strong></summary>

```json
{
  "dataDirectory": "/path/to/data",
  "registryPort": 4873,
  "registryUrl": "http://localhost:4873",
  "verdaccioConfig": {}
}
```

</details>

<details>
<summary><strong>Configuration Options</strong></summary>

- **`dataDirectory`** (string, optional): The base directory where all local-npm-registry data should be stored. If not specified, defaults to the user's home directory. A `.local-npm-registry` subdirectory will be created within this directory.

- **`registryPort`** (number, optional): The port number for the local Verdaccio registry server. Defaults to `4873`.

- **`registryUrl`** (string, optional): The full URL of the local Verdaccio registry. Defaults to `http://localhost:4873`.

- **`verdaccioConfig`** (object, optional): Custom Verdaccio configuration that will override the default settings. This allows you to customize the registry behavior beyond the basic options.

</details>

<details>
<summary><strong>Creating a Configuration File</strong></summary>

You can create a default configuration file in your project using:

```bash
local-npm init-config
```

This will create a `.local-npm-registry.json` file in the current directory with default values that you can then customize.

</details>

## 📋 Technical Details

### How It Works

This tool uses Verdaccio (a private npm registry) under the hood to simulate publishing packages locally. It maintains a JSON store that tracks package versions and subscriber relationships, ensuring clean workflows and easy cleanup.

Each publishing directory keeps exactly one version in the registry: publishing again replaces what
that directory published last and leaves every other directory's version alone.

> **Note:** Verdaccio is started and stopped for you. Any command that publishes or installs runs it,
> since local versions resolve nowhere else.

To see more in depth information on the logic and specifics, see [Scenarios](https://github.com/aneuhold/ts-libs/blob/main/docs/local-npm-registry-scenarios.md) which works through behavior one case at a time, from a single library and consumer up to two checkouts of one monorepo publishing at once (e.g. git worktrees).

### Why Not Use Local File Paths?

While npm supports [local file paths](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#local-paths) as dependencies (e.g., `"my-package": "file:../my-package"`), this approach has significant limitations:

- **Different installation behavior**: Local paths don't install the package the same way as remote registries do
- **Missing dependency resolution**: The local package's own dependencies aren't automatically installed in the consuming project
- **No build processes**: Pre-publish scripts and build steps are often skipped
- **Inconsistent testing**: Your local testing environment differs from how the package will actually be consumed in production

This tool solves these issues by using a real npm registry (Verdaccio) locally, ensuring that packages are installed, built, and resolved exactly as they would be when published to the public npm registry.

<details>

<summary><code>local-npm publish</code> Command Flow</summary>

<p align="center">
    <a href="https://mermaid.live/edit#pako:eNpVU1tvmzAU_itHftkLyUIDJEFTpTVp2j7sZZo0aaMPDpyAW7DRsWmWRfnvPZjmUp6w_d3OZ_kgclOgSMW2Nru8kuTg1yrTwN_3v5moTS7rkW4baLtNrWyViWcYjW7hjg9_oiyglfmrLHH8Yo0Gpb9t6OutqxDyjgi1g0IR5s7QnpmD7p0XWLLAb6kcbA1BT2Cr1zNm6TErxixNXbMA7CrpwJlTjvTDSNlTgqBX0SD1nnd1ySvpPKjAFnVhoc_n-LyASlqw3cbmpDZI9uy68q737LrmUCjzKuCRYBBAne_BUIE0eLeq17PgK7pgFNrgFDIYgJ3zwE9NbeTVtPfed-0r3ZFyCPiGtL_K-MUOUtcSXEbfm8YdMNoqoy-TrL3iAys-aetkXfP0OUKL5HVOwn1PLZkXLvhMffDURx-mMW_oi7xc40cSU3MRZ1_Ykml8GsJSWXd1249e7snL1SgtXl-2CERJqhCpow4D0SA1sl-KQ0_OBEMbzETKv4UkZmT6yJxW6j_GNCcama6sRLqVteVV1xbS4UrJkmRz3qX-dmhpOu1EOg1DLyLSg_gn0iQeR9Nknsxm8SKOojAJxF6kYTIfzxfTRZTchHwWJbNjIP5725AP4uhmEsfhdDKZRHNmYKG4nh_DY_Jv6vgOPGwX9A" target="_blank">
        <img width="200" src="https://img.aneuhold.dev/20260813-164226-d966.png"  alt="publish Command Mermaid Diagram" />
    </a>
</p>

</details>

<details>

<summary><code>local-npm subscribe <package-name></code> Command Flow</summary>

<p align="center">
    <a href="https://mermaid.live/edit#pako:eNpdk29v0zAQxr_Kya_T0q5JukZoiP1hGxISAiQkFl648TUxTezo7DC6tt-di9OGibyK7fs999ydvReFVSgysantc1FJ8vDtNjfA3_unXNS2kPXEtA24bu0K0muEdltOjGwwFz9hMrmCa477LrWHjSXwFQJDWz4cVK5DzM0-F5-7da1dhQo2ZBtoLOHbNb258pU0YA2C0oSFt7R7l4vjQN_09CEXO3QRSKPAWN5ppa-g1L_R5OIAt5z_q7ftEMApfO8iSJ8VNTrwForKWoch_ejvnMHYCNj__-J3bPzRjTWDNrCzHQ3q2KJRaAqW_2f5Lggae4APJ2MZSKWAG-Rt4FpZbGWJ01_OGthocn50M8Bc7QHumf6ChSUVMkLREaHx4Fos9Ebj4EE6eK5kLw2Ejkvl9kuPNCreh_4_PI39DyM6WeBWoKsiRjunTXkaBx-fQiWVrjdeS25q51CNsg9B9jF4fCbtcTD5urTBH49EG-dlXY_sY2A_BrZGyRN5dWtEJErSSmSeOoxEg9TIfin2PZwLDu2vXsa_ShITuTky00rzw9rmjJHtykpkG1k7XnWt4p7calmSbMZd6odHN7YzXmSLeRJERLYXf0SWJtN4kV6my2WySuJ4nkZiJ7J5ejm9XC1WcXox57M4XR4j8RLSzvkgiS9mSTJfzGazeBUJVJrn8Wl4XuGVHf8CtesbLw" target="_blank">
        <img width="500" src="https://img.aneuhold.dev/20260813-164424-09f1.png"  alt="subscribe Command Mermaid Diagram" />
    </a>
</p>

</details>

<details>

<summary><code>local-npm unpublish &lt;package-name&gt;</code> Command Flow</summary>

<p align="center">
    <a href="https://mermaid.live/edit#pako:eNpdUl1v2zAM_CsCn50sTmwnMYYOa5x2GLCXocCAzX1QbNrWaksGJa_L0vz30XKafehJ5PHuSEonKEyJkELVmueikeTEQ5Zrwef9txxaU8h2pvtODLofDq2yTQ6PYja7EbcMf5HKicqQcA0Krn1icCLf-prdiWsaVTTiQla6fnugNzelIiycoeO7HM4TYzcyXnJ4Vq7hq2zbWS9dY3N4ERl77X8gHYXR6AX-6Anlrq7_aYz8wPdWDESo3b_egbh0bnTrlUerPVt9HKxjQLopeRHP_Eh3jGdk-pHYiYpM5yUIa2UdNyh16V0ILXvgCCoSvSyeZI3z79ZowYNYZbS9Ku8n5Sm488E923xGi06g5PXZ4WALUgfkhg1PbL2HIVUrLVtheyxUpRhle6G0dby-q_y9V_zgFVuUFv9-LgigJlVC6mjAADqkTo4hnEZyDuOYvIOUr6UkZuT6zJxe6q_GdK80MkPdQFrJ1nI09KV0mClZk-yuWX6AEmlnBu0gXS0jLwLpCX5CmsTzaJVskvU63sZRFCYBHCENk818s11to2QZMhYl63MAv7xtyEAcLRdxHK4Wi0W02QSApeKVf5r-s__W59-_aepz" target="_blank">
        <img width="300" src="https://img.aneuhold.dev/20260813-164514-a119.png"  alt="unpublish Command Mermaid Diagram" />
    </a>
</p>

</details>
<details>

<summary><code>local-npm unsubscribe [&lt;package-name&gt;]</code> Command Flow</summary>

<p align="center">
    <a href="https://mermaid.live/edit#pako:eNpVkt1u2zAMhV-F4LWTxfVPHGPosCZpt4sBQ1FgwOZdKDZjq5Ulg5K3ZUnefYq8BZ2uRPE7hxTBI9amISxxr8zPuhPs4GlTafDn_bcKlamFmumhh1HbcWdrljuq8DvMZrdw54EvQjrYGwbXEXj6xScn-V1g1scKP4v6RbQEWvTUvKvwPAHrC3A6kD3Bxjs9dcKB0QR_6wxOGn11m2BtTrD17PYH8eE_8O2O39y6TloY2DxT7aAzqrFX_SZ0c--1j2SdYQoNG5at1EKBHaiWe0kcfKSGgxkZhqnx-bN91cl2cpqC-xA8eNuP2jqhlP9BTVf2IaQ_hKqKhKXXY8IIW5YNlo5HirAn7sUlxONFXKFHe29V-msj2CsqffaaQeivxvT_ZGzGtsNyL5T10Tg0wtFGipZFf31l0g3x2ozaYZkkSTDB8oi_sMyzeZrkRb5cZqssTeM8wgOWcV7Mi1WySvOb2OfSfHmO8HcoG_tElt4ssixOFotFWhQRUiP9TD9NmxQW6vwHXOq7WQ" target="_blank">
        <img width="400" src="https://img.aneuhold.dev/20260813-164613-dc92.png"  alt="unsubscribe Command Mermaid Diagram" />
    </a>
</p>

</details>

<details>

<summary><code>local-npm prune</code> Command Flow</summary>

<p align="center">
    <a href="https://mermaid.live/edit#pako:eNpNkkGPmzAQhf-KNedkGxIgCaq22g3N9tIeqkqVWnpwYAJWwYPGZrtpkv--g7NF9QnPvO_Nw_YZSqoQMji29KdsNHv1LS-skvXws4CWSt3Obd-pngeLBfxS8_m9epTWd228OhIr36AS3W9p3sDHoNmJZm9spfrh0BrXGFuryjCWntige3_gd_e-0V5ZEtzWyApfjPOTzS7Y5OcCHuzpQwHXWzkfyxdLF_VRJnwhH5w9qYom9KY5obuovYhypn6MaWSE9eN0pSUYY0fP-BZkbD4jO0PWqSNTF_6LsZZIfJqc9yHUk5h-RYf-zdUNB1eyOQg_OgdLY53XbTuRT4H8FMgWtcP_Dw5mULOpIPM84Aw65E6PWziPcAEi7eT0M_msNAtR2KswvbY_iLp_GNNQN5AddetkN_SV9pgbXbPupiqjrZB3NFgP2SpeBhPIzvACWZrcxat0k67XyTaJ4yidwQmyKN3cbbarbZwuI-nF6fo6g79hbCSNJF4ukiRaLRaLeCMEVkZu-PPtVYXHdX0FbQrBag" target="_blank">
        <img width="400" src="https://img.aneuhold.dev/20260813-164721-0e50.png"  alt="unsubscribe Command Mermaid Diagram" />
    </a>
</p>

</details>

### Local JSON Store Structure

Every package is keyed by its name, then by the absolute path of the directory it is published from,
so two copies of one repository each get their own entry.

Published versions take the form `<yourVersion>-<pathSlug>.<timestamp>`. The slug is derived from the
publishing directory's path, which a version cannot hold whole, and it is what keeps two publishing
directories of one package from landing on the same version. You never have to type it: every
command takes a path.

```json
{
  "version": 2,
  "packages": {
    "@aneuhold/core-ts-lib": {
      "/path/to/core-ts-lib": {
        "originalVersion": "1.2.3",
        "currentVersion": "1.2.3-pa1b2c3d4.20250526123456789",
        "subscribers": [
          {
            "subscriberPath": "/path/to/subscriber-project-1",
            "originalSpecifier": "^1.2.3"
          },
          {
            "subscriberPath": "/path/to/subscriber-project-2",
            "originalSpecifier": "~1.2.0"
          }
        ],
        "publishArgs": ["--ignore-scripts", "--verbose"]
      }
    },
    "@aneuhold/be-ts-lib": {
      "/path/to/be-ts-lib": {
        "originalVersion": "2.1.0",
        "currentVersion": "2.1.0-pf9e8d7c6.20250526134567890",
        "subscribers": [
          {
            "subscriberPath": "/path/to/subscriber-project-3",
            "originalSpecifier": "^2.1.0"
          }
        ]
      }
    }
  }
}
```

