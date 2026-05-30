# create-ropo

Scaffold a new project from the [`stack-base`](https://github.com/RobertoRodriguezCarbonell/stack-base)
boilerplate — Next.js 16 + Auth.js + Drizzle/Neon + Resend + (optional) R2.

## Usage

```bash
pnpm create ropo my-app
# or: npm create ropo@latest my-app
# or: bun create ropo my-app
```

Then follow the prompts. It will:

1. Clone the `stack-base` template (fresh git history).
2. Rename the brand to your project name.
3. Optionally `git init` + install dependencies.

Finally:

```bash
cd my-app
cp .env.example .env.local   # fill in your credentials
pnpm db:migrate
pnpm dev
```

## Notes

- **Private template:** the default template repo is private, so cloning uses
  your own git credentials (SSH or an https credential helper). Override the
  source with the `ROPO_TEMPLATE` env var, e.g.:
  ```bash
  ROPO_TEMPLATE=git@github.com:RobertoRodriguezCarbonell/stack-base.git pnpm create ropo my-app
  ```
- **Zero dependencies:** the CLI uses only Node.js built-ins (`node >= 20`).
- v1 scaffolds the `base` archetype only. Future archetypes (saas, landing,
  internal-tool) will be added to the prompt as they exist.

## Local development

```bash
node index.js ../tmp-test-app   # run the CLI without publishing
```
