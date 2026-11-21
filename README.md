# Vexon engine

Local-first memory for AI agents. Notes are plain Markdown files on disk.

```
node bin/vexon.js init
node bin/vexon.js note "title" "body" --tag t
node bin/vexon.js list
node bin/vexon.js recall "cookies"   # hybrid ranking, trimmed to the token budget
npm test
```

## Model

Semantic search uses all-MiniLM-L6-v2 (Apache-2.0) from the npm package
`@maycombhq/embed-model` (third-party publisher). Each load checks the model
files against the package's `pins.json`. Vectors are cached in `vectors.json`
in the store. If the model fails to load, search falls back to keywords.

## Capture from Claude Code

Add this to `~/.claude/settings.json`. Only prompts that start with `remember:` are saved.

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command", "command": "node /path/to/vexon-engine/bin/vexon.js capture" } ] }
    ]
  }
}
```

## MCP server

Any MCP client can run `node /path/to/vexon-engine/bin/vexon.js mcp`. It exposes
`vexon_recall` and `vexon_capture`.

**Until secret scrubbing lands (M4), do not capture secrets.** Captured text is
written to disk as is.
