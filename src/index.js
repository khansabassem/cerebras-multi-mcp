#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import https from "https";
import fs from "fs/promises";
import path from "path";
import { createPatch } from "diff";

// ── Config ──────────────────────────────────────────────────────────────────

const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const MODELS = {
  cerebras_quick: {
    id: "llama3.1-8b",
    label: "Quick (8B)",
    description:
      "Fastest model for simple edits, boilerplate, single-function generation. Use for trivial tasks where speed matters most.",
  },
  cerebras_complex: {
    id: "gpt-oss-120b",
    label: "Complex (120B)",
    description:
      "Large model for multi-file features, CRUD APIs, complex components, and demanding code generation tasks.",
  },
  cerebras_reasoning: {
    id: "zai-glm-4.7",
    label: "Reasoning (357B)",
    description:
      "Most powerful model for algorithms, architecture decisions, advanced logic, and tasks requiring deep reasoning.",
  },
  cerebras_instruct: {
    id: "qwen-3-235b-a22b-instruct-2507",
    label: "Instruct (235B)",
    description:
      "Instruction-tuned model for precise instruction following, documentation-heavy code, typed interfaces, and detailed specs.",
  },
};

// Keywords used by cerebras_auto to pick a model
const REASONING_KEYWORDS = [
  "algorithm",
  "architect",
  "complexity",
  "optimize",
  "design pattern",
  "data structure",
  "pathfind",
  "recursive",
  "dynamic programming",
  "graph",
  "tree",
  "proof",
  "theorem",
  "big-o",
  "trade-off",
];
const INSTRUCT_KEYWORDS = [
  "document",
  "jsdoc",
  "typedoc",
  "readme",
  "interface",
  "type definition",
  "typedef",
  "specification",
  "schema",
  "openapi",
  "swagger",
  "annotate",
];
const COMPLEX_KEYWORDS = [
  "crud",
  "rest api",
  "full",
  "multi-file",
  "component",
  "service",
  "middleware",
  "authentication",
  "database",
  "migration",
  "integration",
];

// ── Language detection ───────────────────────────────────────────────────────

const LANG_MAP = {
  ".py": "python",
  ".js": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".jsx": "javascript",
  ".java": "java",
  ".cpp": "cpp",
  ".c": "c",
  ".cs": "csharp",
  ".php": "php",
  ".rb": "ruby",
  ".go": "go",
  ".rs": "rust",
  ".swift": "swift",
  ".kt": "kotlin",
  ".sh": "bash",
  ".sql": "sql",
  ".html": "html",
  ".css": "css",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".md": "markdown",
};

function detectLang(filePath) {
  return LANG_MAP[path.extname(filePath).toLowerCase()] || "text";
}

// ── File helpers ─────────────────────────────────────────────────────────────

async function readFile(filePath) {
  try {
    let p = filePath;
    if (!path.isAbsolute(p)) {
      if (p.startsWith("~"))
        p = p.replace("~", process.env.HOME || process.env.USERPROFILE);
      else p = path.join(process.cwd(), p);
    }
    return await fs.readFile(p, "utf-8");
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

async function writeFileSafe(filePath, content) {
  let p = filePath;
  if (!path.isAbsolute(p)) {
    if (p.startsWith("~"))
      p = p.replace("~", process.env.HOME || process.env.USERPROFILE);
    else p = path.join(process.cwd(), p);
  }
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, "utf-8");
}

// ── Code cleaner (strip markdown fences) ─────────────────────────────────────

function cleanCode(response) {
  if (!response) return response;
  const blocks = [];
  const re = /```[a-zA-Z]*\n?([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(response)) !== null) blocks.push(m[1].trim());
  if (blocks.length > 0) return blocks[0];
  return response
    .replace(/```[a-zA-Z]*\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
}

// ── HTTP POST helper ─────────────────────────────────────────────────────────

function httpPost(hostname, apiPath, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname,
      port: 443,
      path: apiPath,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
        ...headers,
      },
    };
    const req = https.request(opts, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try {
          const json = JSON.parse(raw);
          if (res.statusCode === 200 && json.choices && json.choices[0]) {
            resolve(json.choices[0].message.content);
          } else {
            reject(
              new Error(
                `API ${res.statusCode}: ${json.error?.message || "Unknown error"}`
              )
            );
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });
    req.on("error", (e) => reject(e));
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error("Request timeout after 60s"));
    });
    req.write(data);
    req.end();
  });
}

// ── Cerebras API call ────────────────────────────────────────────────────────

async function callCerebras(modelId, prompt, systemPrompt, temperature, maxTokens) {
  if (!CEREBRAS_API_KEY) throw new Error("CEREBRAS_API_KEY not set");
  const body = {
    model: modelId,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    temperature: temperature ?? 0.1,
    stream: false,
  };
  if (maxTokens) body.max_tokens = maxTokens;
  return httpPost(
    "api.cerebras.ai",
    "/v1/chat/completions",
    { Authorization: `Bearer ${CEREBRAS_API_KEY}` },
    body
  );
}

// ── OpenRouter fallback ──────────────────────────────────────────────────────

async function callOpenRouter(modelId, prompt, systemPrompt, temperature, maxTokens) {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");
  const orModelMap = {
    "llama3.1-8b": "meta-llama/llama-3.1-8b-instruct",
    "gpt-oss-120b": "cerebras/gpt-oss-120b",
    "zai-glm-4.7": "cerebras/zai-glm-4.7",
    "qwen-3-235b-a22b-instruct-2507": "qwen/qwen3-235b-a22b",
  };
  const body = {
    model: orModelMap[modelId] || modelId,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    temperature: temperature ?? 0.1,
    stream: false,
  };
  if (maxTokens) body.max_tokens = maxTokens;
  return httpPost(
    "openrouter.ai",
    "/api/v1/chat/completions",
    {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://github.com/khansabassem/cerebras-multi-mcp",
      "X-Title": "Cerebras Multi MCP",
    },
    body
  );
}

// ── Generate with fallback ───────────────────────────────────────────────────

async function generate(modelId, prompt, systemPrompt, temperature, maxTokens) {
  try {
    return await callCerebras(modelId, prompt, systemPrompt, temperature, maxTokens);
  } catch (primaryErr) {
    console.error(
      `Cerebras failed (${modelId}): ${primaryErr.message}, trying OpenRouter...`
    );
    try {
      return await callOpenRouter(modelId, prompt, systemPrompt, temperature, maxTokens);
    } catch (fallbackErr) {
      throw new Error(
        `Both providers failed.\nCerebras: ${primaryErr.message}\nOpenRouter: ${fallbackErr.message}`
      );
    }
  }
}

// ── Auto model selector ──────────────────────────────────────────────────────

function autoSelectModel(prompt) {
  const lower = prompt.toLowerCase();
  const wordCount = prompt.split(/\s+/).length;

  if (REASONING_KEYWORDS.some((kw) => lower.includes(kw)))
    return MODELS.cerebras_reasoning;
  if (INSTRUCT_KEYWORDS.some((kw) => lower.includes(kw)))
    return MODELS.cerebras_instruct;
  if (COMPLEX_KEYWORDS.some((kw) => lower.includes(kw)))
    return MODELS.cerebras_complex;
  if (wordCount > 200) return MODELS.cerebras_complex;
  return MODELS.cerebras_quick;
}

// ── Core tool handler ────────────────────────────────────────────────────────

async function handleWrite(toolName, args) {
  const {
    file_path,
    prompt,
    context_files = [],
    temperature,
    max_tokens,
  } = args;
  if (!file_path) throw new Error("file_path is required");
  if (!prompt) throw new Error("prompt is required");

  // Determine model
  let model;
  if (toolName === "cerebras_auto") {
    model = autoSelectModel(prompt);
  } else {
    model = MODELS[toolName];
  }
  if (!model) throw new Error(`Unknown tool: ${toolName}`);

  const language = detectLang(file_path);

  // Build prompt with context
  let fullPrompt = "";

  // Add context files
  if (context_files.length > 0) {
    const filtered = context_files.filter(
      (f) => path.resolve(f) !== path.resolve(file_path)
    );
    if (filtered.length > 0) {
      fullPrompt += "Context Files:\n";
      for (const cf of filtered) {
        try {
          const content = await readFile(cf);
          if (content) {
            const lang = detectLang(cf);
            fullPrompt += `\nFile: ${cf}\n\`\`\`${lang}\n${content}\n\`\`\`\n`;
          }
        } catch (e) {
          console.error(`Warning: could not read context file ${cf}: ${e.message}`);
        }
      }
      fullPrompt += "\n";
    }
  }

  // Add existing file content if editing
  const existingContent = await readFile(file_path);
  if (existingContent !== null) {
    fullPrompt += `Existing file content:\n\`\`\`${language}\n${existingContent}\n\`\`\`\n\n`;
  }

  fullPrompt += `Generate ${language} code for: ${prompt}`;

  const systemPrompt = `You are an expert programmer. Generate ONLY clean, functional code in ${language} with no explanations, comments about the code generation process, or markdown formatting. Include necessary imports and ensure the code is ready to run. When modifying existing files, preserve the structure and style while implementing the requested changes. Output raw code only. Never use markdown code blocks.`;

  // Call API
  const rawResult = await generate(
    model.id,
    fullPrompt,
    systemPrompt,
    temperature,
    max_tokens
  );
  const cleanResult = cleanCode(rawResult);

  // Write to disk
  await writeFileSafe(file_path, cleanResult);

  // Build response
  const fileName = path.basename(file_path);
  const isEdit = existingContent !== null;

  let summary;
  if (isEdit) {
    const patch = createPatch(fileName, existingContent, cleanResult);
    const adds = (patch.match(/^\+[^+]/gm) || []).length;
    const dels = (patch.match(/^-[^-]/gm) || []).length;
    summary = `Updated ${fileName} using ${model.label} (${model.id})\n${adds} addition${adds !== 1 ? "s" : ""}, ${dels} removal${dels !== 1 ? "s" : ""}\nFile: ${file_path}`;
  } else {
    const lines = cleanResult.split("\n").length;
    summary = `Created ${fileName} using ${model.label} (${model.id})\n${lines} line${lines !== 1 ? "s" : ""}\nFile: ${file_path}`;
  }

  if (toolName === "cerebras_auto") {
    summary = `[Auto-selected: ${model.label}]\n${summary}`;
  }

  return { content: [{ type: "text", text: summary }] };
}

// ── Tool schema builder ──────────────────────────────────────────────────────

function buildToolSchema(name, description) {
  return {
    name,
    description,
    inputSchema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description:
            "REQUIRED: Absolute path to the file to create or modify.",
        },
        prompt: {
          type: "string",
          description:
            "REQUIRED: Detailed code generation instructions. Include method signatures, data structures, error handling requirements, and integration details.",
        },
        context_files: {
          type: "array",
          items: { type: "string" },
          description:
            "OPTIONAL: Array of file paths to read as context for the generation.",
        },
        temperature: {
          type: "number",
          description: "OPTIONAL: Sampling temperature (default 0.1).",
        },
        max_tokens: {
          type: "number",
          description: "OPTIONAL: Maximum tokens in the response.",
        },
      },
      required: ["file_path", "prompt"],
    },
  };
}

// ── MCP Server setup ─────────────────────────────────────────────────────────

const server = new Server(
  {
    name: "cerebras-multi-mcp",
    version: "1.0.0",
  },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    buildToolSchema(
      "cerebras_quick",
      `Fast code generation using Cerebras llama3.1-8b (8B params). ${MODELS.cerebras_quick.description}`
    ),
    buildToolSchema(
      "cerebras_complex",
      `Heavy-duty code generation using Cerebras gpt-oss-120b (120B params). ${MODELS.cerebras_complex.description}`
    ),
    buildToolSchema(
      "cerebras_reasoning",
      `Advanced reasoning code generation using Cerebras zai-glm-4.7 (357B params). ${MODELS.cerebras_reasoning.description}`
    ),
    buildToolSchema(
      "cerebras_instruct",
      `Instruction-following code generation using Cerebras qwen-3-235b (235B params). ${MODELS.cerebras_instruct.description}`
    ),
    buildToolSchema(
      "cerebras_auto",
      "Auto-selects the best Cerebras model based on prompt complexity. Simple tasks use 8B, complex features use 120B, reasoning tasks use 357B, documentation tasks use 235B. Use this when unsure which model fits."
    ),
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (name in MODELS || name === "cerebras_auto") {
    try {
      return await handleWrite(name, args);
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
      };
    }
  }
  throw new Error(`Unknown tool: ${name}`);
});

// ── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
