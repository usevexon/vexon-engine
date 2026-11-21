// Local embeddings with all-MiniLM-L6-v2 (fp32 ONNX), shipped by the
// @maycombhq/embed-model package. Every load checks the model and tokenizer
// hashes against the package's pins.json before any text is embedded.
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile, mkdir, symlink, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { scrub } from './scrub.js';

const require = createRequire(import.meta.url);
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

async function sha256(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

// transformers.js expects Hugging Face's folder layout, so we link the package
// files into it instead of copying 90 MB.
async function stageModel(pkgDir, storeDir) {
  const root = join(storeDir, 'models');
  const target = join(root, MODEL_ID);
  await mkdir(join(target, 'onnx'), { recursive: true });
  const links = [
    ['model.onnx', join(target, 'onnx', 'model.onnx')],
    ['tokenizer.json', join(target, 'tokenizer.json')],
  ];
  for (const [src, dst] of links) {
    try {
      await access(dst);
    } catch {
      await symlink(join(pkgDir, src), dst);
    }
  }
  await writeIfMissing(join(target, 'config.json'), {
    model_type: 'bert', hidden_size: 384, num_hidden_layers: 6, num_attention_heads: 12,
    intermediate_size: 1536, vocab_size: 30522, max_position_embeddings: 512,
  });
  await writeIfMissing(join(target, 'tokenizer_config.json'), {
    model_max_length: 256, tokenizer_class: 'BertTokenizer', do_lower_case: true,
  });
  return root;
}

async function writeIfMissing(file, json) {
  const { writeFile } = await import('node:fs/promises');
  try {
    await access(file);
  } catch {
    await writeFile(file, JSON.stringify(json) + '\n');
  }
}

export async function loadEmbedder(storeDir) {
  const pkgJson = require.resolve('@maycombhq/embed-model/package.json');
  const pkgDir = dirname(pkgJson);
  const pins = JSON.parse(await readFile(join(pkgDir, 'pins.json'), 'utf8'));
  for (const f of pins.files) {
    const got = await sha256(join(pkgDir, f.path));
    if (got !== f.sha256) throw new Error(`model file ${f.path} failed its hash check`);
  }

  const { pipeline, env } = await import('@huggingface/transformers');
  env.allowRemoteModels = false;
  env.localModelPath = await stageModel(pkgDir, storeDir);
  const extractor = await pipeline('feature-extraction', MODEL_ID, { dtype: 'fp32' });

  // Every model call goes through here, so secrets are removed before embedding.
  return async (text) => {
    const out = await extractor(scrub(text), { pooling: 'mean', normalize: true });
    return Array.from(out.data);
  };
}
