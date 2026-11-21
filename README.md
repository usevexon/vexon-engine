# Vexon engine

Local-first memory for AI agents. Notes are plain Markdown files on disk.

```
node bin/vexon.js init
node bin/vexon.js note "title" "body" --tag t
node bin/vexon.js list
node bin/vexon.js search "cookies"   # hybrid: keywords + local embeddings
npm test
```

## Model

Semantic search uses all-MiniLM-L6-v2 (Apache-2.0) from the npm package
`@maycombhq/embed-model` (third-party publisher). Each load checks the model
files against the package's `pins.json`. Vectors are cached in `vectors.json`
in the store. If the model fails to load, search falls back to keywords.
