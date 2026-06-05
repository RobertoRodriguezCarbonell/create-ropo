# create-ropo

Scaffold a new project from one of my `stack-*` boilerplate archetypes:

| Template  | Repo                                                                                 | What you get                                              |
| --------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `base`    | [`stack-base`](https://github.com/RobertoRodriguezCarbonell/stack-base)               | Next.js 16 + Auth.js + Drizzle/Neon + Resend + (opt.) R2   |
| `landing` | [`stack-landing`](https://github.com/RobertoRodriguezCarbonell/stack-landing)         | Pre-launch landing with a Resend waitlist (no auth/DB)     |

## Usage

```bash
pnpm create ropo my-app                 # interactive (picks template, install, git)
pnpm create ropo my-app -t landing      # choose the archetype directly
pnpm create ropo my-app -y              # defaults: base + install + git
# or: npm create ropo@latest my-app / bun create ropo my-app
```

It will:

1. Clone the chosen template (fresh git history).
2. Rename the brand (`stack-base` / `stack-landing`) to your project name.
3. Optionally `git init` + install dependencies.

Then:

```bash
cd my-app
cp .env.example .env.local   # fill in your credentials
pnpm db:migrate              # base only — landing has no database
pnpm dev
```

## Flags

| Flag                      | Effect                                        |
| ------------------------- | --------------------------------------------- |
| `-t`, `--template <name>` | Archetype: `base` (default) or `landing`      |
| `-y`, `--yes`             | Accept all defaults (base + install + git)    |
| `--install` / `--no-install` | Force dependency install on/off            |
| `--git` / `--no-git`      | Force git init on/off                         |

## Notes

- **Private templates:** the template repos are private, so cloning uses your
  own git credentials (SSH or an https credential helper). Override the source
  repo of the chosen archetype with the `ROPO_TEMPLATE` env var, e.g.:
  ```bash
  ROPO_TEMPLATE=git@github.com:RobertoRodriguezCarbonell/stack-landing.git pnpm create ropo my-app -t landing
  ```
- **Zero dependencies:** the CLI uses only Node.js built-ins (`node >= 20`).
- Future archetypes (saas, internal-tool) will be added as they exist.

## Local development

```bash
node index.js ../tmp-test-app   # run the CLI without publishing
```
