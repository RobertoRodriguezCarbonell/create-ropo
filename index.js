#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { basename, join, resolve } from "node:path"
import { stdin as input, stdout as output } from "node:process"
import { createInterface } from "node:readline/promises"

/**
 * create-ropo — scaffolds a new project from the stack-base boilerplate.
 *
 * Usage:
 *   pnpm create ropo my-app            (interactive)
 *   pnpm create ropo my-app -y         (accept defaults: install + git)
 *   pnpm create ropo my-app --no-install --no-git
 *
 * v1 (base only): clone the template, strip its git history, rename the brand
 * to your project name, optionally init git + install dependencies.
 *
 * The template defaults to the private stack-base repo, so cloning uses your
 * own git credentials. Override the source with the ROPO_TEMPLATE env var.
 */
const TEMPLATE_REPO =
  process.env.ROPO_TEMPLATE ??
  "https://github.com/RobertoRodriguezCarbonell/stack-base.git"

const BRAND = "stack-base"

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[22m`,
  bold: (s) => `\x1b[1m${s}\x1b[22m`,
  green: (s) => `\x1b[32m${s}\x1b[39m`,
  cyan: (s) => `\x1b[36m${s}\x1b[39m`,
  red: (s) => `\x1b[31m${s}\x1b[39m`,
}

function die(msg) {
  console.error("\n" + c.red("✗ " + msg) + "\n")
  process.exit(1)
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts })
  if (r.error || r.status !== 0) {
    die(`\`${cmd} ${args.join(" ")}\` failed.`)
  }
}

function detectPackageManager() {
  const ua = process.env.npm_config_user_agent ?? ""
  if (ua.startsWith("pnpm")) return "pnpm"
  if (ua.startsWith("yarn")) return "yarn"
  if (ua.startsWith("bun")) return "bun"
  return "npm"
}

function slugify(name) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-~]+/g, "-")
      .replace(/^-+|-+$/g, "") || "my-app"
  )
}

const SKIP_DIRS = new Set([".git", "node_modules", ".next", "drizzle", ".vercel"])
const SKIP_FILES = new Set([
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "bun.lockb",
])
const TEXT_EXT =
  /\.(ts|tsx|js|jsx|mjs|cjs|mts|json|md|mdx|css|html|txt|yaml|yml)$/i

/** Replace every occurrence of `from` with `to` in text files under `dir`. */
function replaceInTree(dir, from, to) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        replaceInTree(join(dir, entry.name), from, to)
      }
    } else if (
      entry.isFile() &&
      !SKIP_FILES.has(entry.name) &&
      TEXT_EXT.test(entry.name)
    ) {
      const file = join(dir, entry.name)
      const content = readFileSync(file, "utf8")
      if (content.includes(from)) {
        writeFileSync(file, content.split(from).join(to))
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2)
  const positionals = args.filter((a) => !a.startsWith("-"))
  const has = (...names) => names.some((n) => args.includes(n))

  const yes = has("-y", "--yes")
  const interactive = Boolean(input.isTTY) && !yes

  console.log(
    "\n" + c.bold(c.cyan("create-ropo")) + c.dim("  scaffold from stack-base\n")
  )

  const rl = interactive ? createInterface({ input, output }) : null
  const ask = async (question, def) => {
    if (!rl) return def
    const a = (
      await rl.question(`${question}${def ? c.dim(` (${def})`) : ""}: `)
    ).trim()
    return a || def || ""
  }
  const askYesNo = async (question, def) => {
    const a = await ask(`${question} ${def ? "[Y/n]" : "[y/N]"}`, "")
    if (!a) return def
    return a.toLowerCase().startsWith("y")
  }

  // Target directory: positional arg, else prompt, else default.
  const target = positionals[0] || (await ask("Project directory", "my-app"))
  const dir = resolve(process.cwd(), target)
  const name = slugify(basename(dir))

  if (existsSync(dir) && readdirSync(dir).length > 0) {
    rl?.close()
    die(`Directory "${target}" already exists and is not empty.`)
  }

  // Install / git: flags win, otherwise prompt (or default when non-interactive).
  const doInstall = has("--no-install")
    ? false
    : has("--install") || yes
      ? true
      : await askYesNo("Install dependencies now?", true)
  const doGit = has("--no-git")
    ? false
    : has("--git") || yes
      ? true
      : await askYesNo("Initialize a git repository?", true)
  rl?.close()

  const pm = detectPackageManager()

  console.log(c.dim(`\n→ Cloning template into ${target}/ …`))
  run("git", ["clone", "--depth", "1", TEMPLATE_REPO, dir])
  rmSync(join(dir, ".git"), { recursive: true, force: true })

  console.log(c.dim(`→ Renaming "${BRAND}" → "${name}" …`))
  replaceInTree(dir, BRAND, name)

  if (doGit) {
    console.log(c.dim("→ Initializing git …"))
    run("git", ["init", "-q"], { cwd: dir })
    run("git", ["add", "-A"], { cwd: dir })
    run("git", ["commit", "-q", "-m", "chore: initialize from stack-base"], {
      cwd: dir,
    })
  }

  // Dependency install is best-effort: a failure shouldn't throw away the
  // scaffold. Warn and let the user run it manually.
  let installed = false
  if (doInstall) {
    console.log(c.dim(`→ Installing dependencies with ${pm} …\n`))
    // On Windows, pnpm/npm/yarn are `.cmd` shims that spawnSync can't run
    // without a shell.
    const r = spawnSync(pm, ["install"], {
      stdio: "inherit",
      cwd: dir,
      shell: process.platform === "win32",
    })
    installed = !r.error && r.status === 0
    if (!installed) {
      console.warn(
        "\n" +
          c.red(`⚠ \`${pm} install\` failed`) +
          c.dim(" — your project is ready; run install manually (see below).")
      )
    }
  }

  const runCmd = pm === "npm" ? "npm run" : pm
  console.log("\n" + c.green("✓ Done!") + " Next steps:\n")
  console.log("  " + c.cyan(`cd ${target}`))
  if (!installed) console.log("  " + c.cyan(`${pm} install`))
  console.log(
    "  " +
      c.cyan("cp .env.example .env.local") +
      c.dim("   # fill in your credentials")
  )
  console.log("  " + c.cyan(`${runCmd} db:migrate`))
  console.log("  " + c.cyan(`${runCmd} dev`) + "\n")
  console.log(
    c.dim("  See README.md for the full setup (Neon, GitHub OAuth, Resend…).\n")
  )
}

main().catch((error) => die(error?.message ?? String(error)))
