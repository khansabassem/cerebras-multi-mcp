# 🧠 Cerebras Multi-Model MCP Server

> **Use multiple Cerebras models from Claude Desktop & Claude Code — with automatic model selection.**

[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue?style=for-the-badge)](https://modelcontextprotocol.io)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

---

## The Problem

The official Cerebras MCP package only supports **one model per session** — you pick a model via an environment variable, and you're stuck with it until you restart. Want to use the fast 8B model for boilerplate and the 357B model for complex reasoning? You'd need two separate MCP server configs.

## The Solution

**cerebras-multi-mcp** exposes **5 tools** — one for each Cerebras model plus an auto-selector — so you (or Claude) can pick the right model **per task**, in the same session, with zero restarts.

```
┌─────────────────────────────────────────────────┐
│              Claude Desktop / Code               │
├─────────────────────────────────────────────────┤
│                                                  │
│  cerebras_quick     → llama3.1-8b      (8B)     │
│  cerebras_complex   → gpt-oss-120b     (120B)   │
│  cerebras_reasoning → zai-glm-4.7      (357B)   │
│  cerebras_instruct  → qwen-3-235b      (235B)   │
│  cerebras_auto      → picks the best one        │
│                                                  │
├─────────────────────────────────────────────────┤
│         Cerebras API  ←→  OpenRouter Fallback    │
└─────────────────────────────────────────────────┘
```

---

## Models

| Tool | Model | Params | Best For |
|------|-------|--------|----------|
| `cerebras_quick` | llama3.1-8b | 8B | Simple edits, boilerplate, single functions. Fastest. |
| `cerebras_complex` | gpt-oss-120b | 120B | Multi-file features, CRUD APIs, complex components. |
| `cerebras_reasoning` | zai-glm-4.7 | 357B | Algorithms, architecture, advanced logic, deep reasoning. |
| `cerebras_instruct` | qwen-3-235b | 235B | Precise instructions, documentation, typed interfaces, specs. |
| `cerebras_auto` | *auto-selected* | — | Analyzes your prompt and picks the best model automatically. |

### Auto-Selection Logic

`cerebras_auto` analyzes your prompt keywords and complexity:

- **Reasoning keywords** (algorithm, optimize, recursive, big-o…) → 357B
- **Instruct keywords** (document, jsdoc, schema, openapi…) → 235B
- **Complex keywords** (crud, rest api, multi-file, database…) → 120B
- **Everything else** or short prompts → 8B (fastest)

---

## Installation

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- A [Cerebras API key](https://cloud.cerebras.ai/) (free tier available)
- *(Optional)* An [OpenRouter API key](https://openrouter.ai/) for fallback

### Setup

```bash
git clone https://github.com/khansabassem/cerebras-multi-mcp.git
cd cerebras-multi-mcp
npm install
```

---

## Configuration

### Claude Desktop

Edit your Claude Desktop config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add the `cerebras-multi` entry:

```json
{
  "mcpServers": {
    "cerebras-multi": {
      "command": "node",
      "args": ["<path-to>/cerebras-multi-mcp/src/index.js"],
      "env": {
        "CEREBRAS_API_KEY": "your-cerebras-api-key",
        "OPENROUTER_API_KEY": "your-openrouter-api-key"
      }
    }
  }
}
```

Restart Claude Desktop to load the new server.

### Claude Code

```bash
claude mcp add cerebras-multi \
  -e CEREBRAS_API_KEY=your-cerebras-api-key \
  -e OPENROUTER_API_KEY=your-openrouter-api-key \
  -- node /path/to/cerebras-multi-mcp/src/index.js
```

---

## Usage

Once configured, you'll see 5 new tools in Claude. Each tool accepts:

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_path` | Yes | Absolute path to the file to create or modify |
| `prompt` | Yes | Detailed code generation instructions |
| `context_files` | No | Array of file paths to read as context |
| `temperature` | No | Sampling temperature (default: 0.1) |
| `max_tokens` | No | Maximum tokens in the response |

### Examples

**Quick boilerplate** with the 8B model:
```
Tool: cerebras_quick
file_path: /project/src/server.js
prompt: Create an Express server with health check endpoint on port 3000
```

**Complex feature** with the 120B model:
```
Tool: cerebras_complex
file_path: /project/src/auth/middleware.ts
prompt: Create JWT authentication middleware with refresh token rotation
context_files: ["/project/src/types/auth.ts", "/project/src/config/env.ts"]
```

**Algorithm design** with the 357B model:
```
Tool: cerebras_reasoning
file_path: /project/src/utils/graph.ts
prompt: Implement Dijkstra's shortest path with a priority queue, supporting weighted directed graphs
```

**Documentation** with the 235B model:
```
Tool: cerebras_instruct
file_path: /project/src/types/api.ts
prompt: Generate TypeScript interfaces for a REST API with OpenAPI-compatible JSDoc annotations
```

**Let the server decide:**
```
Tool: cerebras_auto
file_path: /project/src/cache.ts
prompt: Build an LRU cache with O(1) get and put using a doubly linked list
```

---

## Features

- **Per-call model selection** — no restarts, no env var juggling
- **Auto-select mode** — keyword analysis picks the right model for you
- **OpenRouter fallback** — if Cerebras is unavailable, requests fall through to OpenRouter
- **Smart file handling** — reads existing files for context when editing, creates directories as needed
- **Diff summaries** — shows additions/removals when updating existing files
- **Code cleaning** — strips markdown fences from model output automatically
- **Context files** — pass related files for cross-file awareness

---

## Architecture

```
src/index.js          — Single-file MCP server (~350 lines)
├── Config            — Model definitions, keyword lists, language detection
├── File helpers      — Safe read/write with path resolution
├── HTTP layer        — Cerebras API + OpenRouter fallback
├── Auto-selector     — Keyword-based model routing
├── Tool handler      — Unified handler for all 5 tools
└── MCP server        — ListTools + CallTool with schema factory
```

Built with [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/sdk) using stdio transport.

---

## Why Cerebras?

Cerebras inference runs on purpose-built wafer-scale hardware, delivering up to **20x faster inference** than traditional GPU setups. Combined with MCP, you get near-instant code generation directly inside Claude.

---

## Author

**Bassem EL KHANSAA** — [@ask.bassem](https://askbassem.com)

[![GitHub](https://img.shields.io/badge/GitHub-khansabassem-181717?style=flat-square&logo=github)](https://github.com/khansabassem)
[![Instagram](https://img.shields.io/badge/Instagram-ask.bassem-E4405F?style=flat-square&logo=instagram&logoColor=white)](https://instagram.com/ask.bassem)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-bassemelkhansa-0A66C2?style=flat-square&logo=linkedin)](https://linkedin.com/in/bassemelkhansa)
[![Website](https://img.shields.io/badge/Web-askbassem.com-000?style=flat-square&logo=safari&logoColor=white)](https://askbassem.com)

---

## License

MIT

---

## Contributing

Issues and PRs welcome. If you add a new model, just extend the `MODELS` object and add a tool entry in the `ListToolsRequestSchema` handler.
