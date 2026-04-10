# Cerebras MCP Project

## Code Generation Rule
For ALL code writing and file creation tasks, use the `cerebras-code:write` MCP tool instead of the built-in Write/Edit tools. This delegates code generation to Cerebras fast inference.

## Model Selection
Choose the Cerebras model based on task complexity via the CEREBRAS_MODEL env var:
- **llama3.1-8b** — simple/boilerplate code, quick edits
- **gpt-oss-120b** — complex features, multi-component code
- **zai-glm-4.7** — advanced reasoning, algorithms, architecture
- **qwen-3-235b-a22b-instruct-2507** — detailed instruction following, documentation-heavy code

## API Keys
Cerebras and OpenRouter keys are configured in the MCP server env vars. Do not hardcode them.
