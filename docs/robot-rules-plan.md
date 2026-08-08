# Plan: shared coding-agent rules across repositories

`@aneuhold/robot-rules` is a new package in `packages/robot-rules`. It ships one canonical copy of
the coding conventions that every repository repeats today, as plain markdown. A consuming
repository installs it as a devDependency and references the rules it wants directly from its
`CLAUDE.md`.

The name avoids any single agent. The content is plain markdown with no agent-specific syntax.

## The problem

Every repository carries its own instruction file, and the overlap between them is most of the file.
`workout/.github/copilot-instructions.md` and `ts-libs/.claude/CLAUDE.md` both define naming, JSDoc,
enum, import, and class-ordering rules, in slightly different words. A change to a convention means
editing every repository by hand, and the versions drift.

The rules have to be present in every session on any machine, whatever file type is being edited.
Editing a markdown plan still requires the TypeScript conventions to be in context.

Across many repositories, the update path cannot be a step anyone has to remember. Anything that
must be run per repository on top of the normal workflow will be skipped somewhere and go stale
without a signal.

## Design

### The package is markdown and nothing else

```text
packages/robot-rules/
├── rules/
│   ├── typescript.md
│   ├── testing.md
│   ├── svelte.md
│   ├── tailwind.md
│   └── bundles/
│       └── svelte-app.md
├── package.json          # files: ["rules"], no build, no bin
└── README.md             # the list of available rules
```

There is no CLI, no build step, and no source directory. An earlier draft of this plan had an
`add`/`sync`/`check` CLI, which existed only to copy files into consuming repositories. Referencing
the installed package directly removes the copies, and with them the reason for the CLI.

### Consumption is an import line in `CLAUDE.md`

```markdown
Shared conventions are imported below from `@aneuhold/robot-rules`.

@../node_modules/@aneuhold/robot-rules/rules/typescript.md
@../node_modules/@aneuhold/robot-rules/rules/testing.md
```

Relative import paths resolve relative to the file holding them, so the `../` is because
`CLAUDE.md` sits in `.claude/`. A repository with a root-level `CLAUDE.md` uses `./node_modules/...`.

Imported files are expanded into context at session start, unconditionally, whatever file type is
being edited. See [verified behavior](#verified-behavior).

### The import lines are the manifest

There is no configuration file and no directory to reconcile. The set of rules a repository has
opted into is the set of import lines in its `CLAUDE.md`, visible in the file anyone already opens
to understand the repository. Adding a rule is adding a line. Removing one is deleting a line.

### Updates ride the normal dependency workflow

The version is pinned by each repository's lockfile. Renovate already bumps `@aneuhold/*`
dependencies across these repositories, so a convention change propagates through the same PR flow
as every other dependency, and `pnpm install` is already run as a matter of course. There is no
per-repository step to remember and nothing that goes stale silently for want of someone running a
command.

### Bundles compose rules

A bundle is a rule file whose body is imports:

```markdown
<!-- rules/bundles/svelte-app.md -->

@../typescript.md
@../testing.md
@../svelte.md
@../tailwind.md
```

A repository then references one line instead of four. Imports nest to a maximum depth of four hops.
A bundle reference costs two of them, `CLAUDE.md` to bundle to rule, leaving headroom. Bundles must
not reference other bundles, which keeps the depth predictable and the composition flat enough to
read.

## Trade-off accepted: the empty state is silent

An import whose file is missing expands to nothing, with no warning in the session. Before
`pnpm install` has run, in a fresh clone or a cloud session, a repository has no shared conventions
and nothing says so.

This is accepted. `pnpm install` is already required before anything else in these repositories can
be done, so the window is narrow, and it is a smaller cost than a step that has to be remembered
per repository forever.

One cheap mitigation is built into the format above. The sentence introducing the imports is
ordinary `CLAUDE.md` body text and loads whether or not the imports resolve, so an agent that sees
the sentence and no conventions has enough to notice the gap and say so.

## The parts

### Part 1: the package

`packages/robot-rules` with its `package.json`, the rule files, and one bundle. The content comes
from splitting `workout/.github/copilot-instructions.md` and `ts-libs/.claude/CLAUDE.md`, keeping
the stricter wording where the two disagree:

- `typescript.md`: types and functions, JSDoc and naming, class structure, imports, enums, barrel
  files, general syntax rules.
- `testing.md`: Vitest conventions, real implementations over mocks, DRY helpers.
- `svelte.md`: Svelte 5 runes, component patterns, stores versus services, service file naming.
- `tailwind.md`: utility classes, `cn()`, spacing scale, CSS variables, minimal class count.
- `bundles/svelte-app.md`: the four above.

What stays in each repository is anything naming that repository's own files: quick commands,
project layout, the `@aneuhold/core-ts-db-lib` section, animations, routes, Storybook, and the
task-completion checklist.

Because the package has no compiled output, it needs the monorepo's publish scripts adapted rather
than copied. See [open questions](#trade-offs-and-open-questions).

### Part 2: convert the consumers

`workout` first, as the repository the content was extracted from. Add the devDependency, add the
import lines to `.claude/CLAUDE.md`, delete the migrated sections from
`.github/copilot-instructions.md`, and confirm through `/context` that the imports resolved. Then
`ts-libs` itself.

Each conversion is its own commit so the deleted sections and the added imports read together.

## Verified behavior

Tested with headless sessions against scratch directories, with all file-reading tools disallowed so
nothing could be discovered at runtime.

1. **Import through a pnpm symlink.** A packed tarball installed with `pnpm add -D`, leaving
   `node_modules/@aneuhold/robot-rules-test` as a symlink into `node_modules/.pnpm/`. A `CLAUDE.md`
   importing through that symlink loaded the content. The symlink target resolves inside the project
   directory, so it does not count as an external import and no approval dialog is involved.
2. **Nested bundle composition.** The `CLAUDE.md` above referenced only `bundles/svelte-app.md`,
   which imported two rule files by relative path. Both rule files' contents were in context. Two
   hops resolve, and relative paths inside the package resolve against the importing file.
3. **Unconditional loading.** A session that touched no files, with no tools available, had the
   imported content at start.

Documented at [code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory):

> Both relative and absolute paths are allowed. Relative paths resolve relative to the file
> containing the import, not the working directory. Imported files can recursively import other
> files, with a maximum depth of four hops.

## Trade-offs and open questions

1. **Publishing a package with no build.** Every other package here compiles TypeScript and
   publishes to both npm and JSR. This one has no `src`, so `build`, `check`, and the JSR scripts
   have nothing to act on. JSR is for JS and TS packages and the whole mechanism is a `node_modules`
   path, so npm only is assumed. The version propagation script should still apply. This is the main
   integration question for part 1.
2. **Copilot gets nothing shared.** The import lines belong in `.claude/CLAUDE.md`, not in
   `.github/copilot-instructions.md`, because Copilot does not expand `@` imports and would render
   them as literal text. So `workout`'s Copilot instructions keep only repository-specific content.
   Given the package was named for tool neutrality, worth deciding whether Copilot parity matters
   enough to warrant a second delivery path later.
3. **Node-only.** A repository with no Node toolchain cannot consume this. Every repository that
   needs it today has one.
4. **Test file naming differs between repositories.** `ts-libs` uses `.spec.ts` and `workout` uses
   `.test.ts`. A single `testing.md` cannot state both. Either the naming line stays in each
   repository's own instructions and only behavioral rules are shared, or the two standardize. The
   first is assumed here, and it is the only conflict found in the extracted content.
5. **Rules already duplicated in the user-level `~/.claude/CLAUDE.md`.** A few conventions exist both
   there and in repository instructions. Contradictory instructions across files are resolved
   arbitrarily, so each rule should end up in exactly one place. Worth an audit during part 2.
