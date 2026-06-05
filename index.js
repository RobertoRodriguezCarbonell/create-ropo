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
 * create-ropo — scaffolds a new project from a stack-* boilerplate archetype.
 *
 * Usage:
 *   pnpm create ropo my-app                       (interactive)
 *   pnpm create ropo my-app -t landing            (pick the archetype)
 *   pnpm create ropo my-app -y                    (defaults: base + install + git)
 *   pnpm create ropo my-app --no-install --no-git
 *
 * It clones the archetype's template repo, strips its git history, renames
 * the brand to your project name, and optionally inits git + installs deps.
 *
 * Template repos are private, so cloning uses your own git credentials.
 * Override the source repo of the chosen archetype with the ROPO_TEMPLATE
 * env var.
 */
const TEMPLATES = {
  base: {
    brand: "stack-base",
    repo: "https://github.com/RobertoRodriguezCarbonell/stack-base.git",
    desc: "the full wired stack (Auth.js, Drizzle/Neon, Resend, R2)",
    // Shown after scaffolding, in order.
    steps: ["cp .env.example .env.local", "db:migrate", "dev"],
    docsHint: "See README.md for the full setup (Neon, GitHub OAuth, Resend…).",
  },
  landing: {
    brand: "stack-landing",
    repo: "https://github.com/RobertoRodriguezCarbonell/stack-landing.git",
    desc: "pre-launch landing page with a Resend waitlist (no auth/DB)",
    steps: ["cp .env.example .env.local", "dev"],
    docsHint: "See README.md for the setup (Resend) and the placeholder copy.",
  },
}

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
/** Extensionless text files that must also be rebranded (e.g. .env.example). */
const isTextFile = (name) => TEXT_EXT.test(name) || name.startsWith(".env")

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
      isTextFile(entry.name)
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
  const has = (...names) => names.some((n) => args.includes(n))

  // Parse --template/-t (value or =form) and collect positionals, making
  // sure the flag's value is not mistaken for the target directory.
  let templateArg = null
  const positionals = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === "-t" || a === "--template") {
      templateArg = args[++i] ?? null
    } else if (a.startsWith("--template=")) {
      templateArg = a.slice("--template=".length)
    } else if (!a.startsWith("-")) {
      positionals.push(a)
    }
  }
  if (templateArg && !TEMPLATES[templateArg]) {
    die(
      `Unknown template "${templateArg}". Available: ${Object.keys(TEMPLATES).join(", ")}.`
    )
  }

  const yes = has("-y", "--yes")
  const interactive = Boolean(input.isTTY) && !yes

  console.log(
    "\n" +
      c.bold(c.cyan("create-ropo")) +
      c.dim("  scaffold from a stack-* archetype\n")
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

  // Archetype: flag wins, otherwise prompt (default base).
  let templateKey = templateArg
  if (!templateKey) {
    if (interactive) {
      console.log("")
      for (const [key, t] of Object.entries(TEMPLATES)) {
        console.log(`  ${c.cyan(key.padEnd(9))}${c.dim(t.desc)}`)
      }
      console.log("")
      templateKey = await ask("Template", "base")
      if (!TEMPLATES[templateKey]) {
        rl?.close()
        die(
          `Unknown template "${templateKey}". Available: ${Object.keys(TEMPLATES).join(", ")}.`
        )
      }
    } else {
      templateKey = "base"
    }
  }
  const tpl = TEMPLATES[templateKey]
  const templateRepo = process.env.ROPO_TEMPLATE ?? tpl.repo

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

  console.log(c.dim(`\n→ Cloning ${templateKey} template into ${target}/ …`))
  run("git", ["clone", "--depth", "1", templateRepo, dir])
  rmSync(join(dir, ".git"), { recursive: true, force: true })

  console.log(c.dim(`→ Renaming "${tpl.brand}" → "${name}" …`))
  replaceInTree(dir, tpl.brand, name)

  if (doGit) {
    console.log(c.dim("→ Initializing git …"))
    run("git", ["init", "-q"], { cwd: dir })
    run("git", ["add", "-A"], { cwd: dir })
    run(
      "git",
      ["commit", "-q", "-m", `chore: initialize from ${tpl.brand}`],
      { cwd: dir }
    )
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
  for (const step of tpl.steps) {
    if (step.startsWith("cp ")) {
      console.log(
        "  " + c.cyan(step) + c.dim("   # fill in your credentials")
      )
    } else {
      console.log("  " + c.cyan(`${runCmd} ${step}`))
    }
  }
  console.log("")
  console.log(c.dim(`  ${tpl.docsHint}\n`))
}

main().catch((error) => die(error?.message ?? String(error)))
