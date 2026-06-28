# Cerebras MCP Server — Test & Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate all 5 MCP tools (cerebras_quick, cerebras_complex, cerebras_reasoning, cerebras_instruct, cerebras_auto) with hello-world smoke tests, fix any errors, rebuild Docker, push to GitHub.

**Architecture:** The server is a single-file stdio MCP server (`src/index.js`) wrapping the Cerebras API (with OpenRouter fallback). Tools all share one `handleWrite` handler that calls a model, strips markdown fences, and writes the result to disk. The Docker image runs `node src/index.js` inside `node:20-alpine`. Claude Code connects via `docker run --rm -i`.

**Tech Stack:** Node.js 20 ESM, `@modelcontextprotocol/sdk` ^1.27.1, `diff` ^8.0.3, Cerebras API, OpenRouter API, Docker.

---

### Task 1: Verify running container and API connectivity

**Files:**
- Read: `src/index.js`
- Read: `Dockerfile`
- Shell: `docker inspect`, `docker logs`

- [ ] **Step 1: Check container logs for startup errors**

Run: `docker logs thirsty_lichterman --tail 30`
Expected: no error output (stdio MCP servers log to stderr; clean start = silence)

- [ ] **Step 2: Verify API keys are present in container**

Run: `docker inspect thirsty_lichterman --format '{{json .Config.Env}}'`
Expected: JSON with `CEREBRAS_API_KEY` and `OPENROUTER_API_KEY` set

- [ ] **Step 3: Commit (nothing to commit yet — just verification)**

---

### Task 2: Smoke-test cerebras_quick

**Files:**
- Tool: `mcp__cerebras__cerebras_quick`
- Output: `/tmp/hello-quick.js` (inside container)

- [ ] **Step 1: Call cerebras_quick with minimal hello-world prompt**

```json
{
  "file_path": "/tmp/hello-quick.js",
  "prompt": "Write a hello world console.log in JavaScript"
}
```

- [ ] **Step 2: Verify response**

Expected: Success text like `Created hello-quick.js using Quick (8B) (llama3.1-8b)\n1 lines\nFile: /tmp/hello-quick.js`
Fail signal: `Error:` prefix in response text

---

### Task 3: Smoke-test cerebras_complex

**Files:**
- Tool: `mcp__cerebras__cerebras_complex`

- [ ] **Step 1: Call cerebras_complex**

```json
{
  "file_path": "/tmp/hello-complex.js",
  "prompt": "Write a hello world console.log in JavaScript"
}
```

- [ ] **Step 2: Verify response — no Error prefix**

---

### Task 4: Smoke-test cerebras_reasoning

**Files:**
- Tool: `mcp__cerebras__cerebras_reasoning`

- [ ] **Step 1: Call cerebras_reasoning**

```json
{
  "file_path": "/tmp/hello-reasoning.js",
  "prompt": "Write a hello world console.log in JavaScript"
}
```

- [ ] **Step 2: Verify response — no Error prefix**

---

### Task 5: Smoke-test cerebras_instruct

**Files:**
- Tool: `mcp__cerebras__cerebras_instruct`

- [ ] **Step 1: Call cerebras_instruct**

```json
{
  "file_path": "/tmp/hello-instruct.js",
  "prompt": "Write a hello world console.log in JavaScript"
}
```

- [ ] **Step 2: Verify response — no Error prefix**

---

### Task 6: Smoke-test cerebras_auto

**Files:**
- Tool: `mcp__cerebras__cerebras_auto`

- [ ] **Step 1: Call cerebras_auto (should auto-select quick/8B for simple prompt)**

```json
{
  "file_path": "/tmp/hello-auto.js",
  "prompt": "Write a hello world console.log in JavaScript"
}
```

- [ ] **Step 2: Verify response includes `[Auto-selected:]` prefix**

---

### Task 7: Fix any bugs found

**Files:**
- Modify: `src/index.js`

- [ ] **Step 1: Identify root cause from error messages**

Common issues to check:
- Model IDs deprecated or renamed on Cerebras API
- OpenRouter model map mismatches
- Missing `max_tokens` cap causing API refusal
- `diff` package v8 API change (createPatch vs unified)

- [ ] **Step 2: Apply targeted fix to src/index.js**

- [ ] **Step 3: Commit fix**

```bash
git add src/index.js
git commit -m "fix: resolve MCP tool errors found during smoke testing"
```

---

### Task 8: Rebuild Docker image

**Files:**
- Read: `Dockerfile`

- [ ] **Step 1: Install dependencies locally to verify package-lock is valid**

Run: `npm ci`
Expected: Exit 0

- [ ] **Step 2: Build new Docker image**

Run: `docker build -t cerebras-multi-mcp:latest .`
Expected: `Successfully built ...`

---

### Task 9: Replace running container

- [ ] **Step 1: Stop and remove old container**

Run: `docker stop thirsty_lichterman && docker rm thirsty_lichterman`

- [ ] **Step 2: Start new container with same API keys**

Run:
```bash
docker run -d \
  -e CEREBRAS_API_KEY=<from-inspect> \
  -e OPENROUTER_API_KEY=<from-inspect> \
  --name cerebras-multi-mcp \
  cerebras-multi-mcp:latest
```

- [ ] **Step 3: Verify new container is running**

Run: `docker ps --filter name=cerebras-multi-mcp`

---

### Task 10: Re-test all 5 tools against new container

Repeat Tasks 2–6 against the new container. All 5 tools must return success responses with no `Error:` prefix.

---

### Task 11: Push to remote

- [ ] **Step 1: Verify git status**

Run: `git status`

- [ ] **Step 2: Push**

Run: `git push origin main`

Expected: `main -> main` or `Everything up-to-date`
