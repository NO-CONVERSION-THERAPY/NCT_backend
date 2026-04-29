#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

class WranglerCommandError extends Error {
  constructor(args, result) {
    super(
      [
        `wrangler ${args.join(' ')} failed with exit code ${result.status}.`,
        result.stdout?.trim(),
        result.stderr?.trim(),
      ].filter(Boolean).join('\n'),
    );
    this.name = 'WranglerCommandError';
    this.args = args;
    this.status = result.status;
    this.stdout = result.stdout ?? '';
    this.stderr = result.stderr ?? '';
  }
}

function parseArgs(argv) {
  const options = {
    config: null,
    migrateBindings: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--config' || arg === '-c') {
      options.config = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === '--migrate') {
      const binding = argv[index + 1];
      if (binding) {
        options.migrateBindings.push(binding);
      }
      index += 1;
    }
  }

  return options;
}

function resolveConfigPath(config) {
  if (config) {
    return path.resolve(config);
  }

  for (const candidate of ['wrangler.toml', 'wrangler.jsonc', 'wrangler.json']) {
    const resolved = path.resolve(candidate);
    if (existsSync(resolved)) {
      return resolved;
    }
  }

  throw new Error('No wrangler config found.');
}

function runWrangler(args) {
  const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(
    executable,
    ['wrangler', ...args],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  if (result.status !== 0) {
    throw new WranglerCommandError(args, result);
  }

  return result.stdout.trim();
}

function parseJsonOutput(output) {
  try {
    return JSON.parse(output);
  } catch (_error) {
    return null;
  }
}

function collectObjects(value, objects = []) {
  if (!value || typeof value !== 'object') {
    return objects;
  }

  if (!Array.isArray(value)) {
    objects.push(value);
  }

  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    collectObjects(child, objects);
  }

  return objects;
}

function findUuid(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] ?? null;
}

function getField(block, key) {
  const normalizedKey = key.replaceAll('"', '');
  return block.match(new RegExp(`"?${normalizedKey}"?\\s*[:=]\\s*"([^"]*)"`, 'm'))?.[1] ?? null;
}

function setTomlField(block, key, value) {
  const escaped = value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  const fieldPattern = new RegExp(`(^\\s*${key}\\s*=\\s*")[^"]*(".*$)`, 'm');
  if (fieldPattern.test(block)) {
    return block.replace(fieldPattern, `$1${escaped}$2`);
  }

  const lines = block.split('\n');
  lines.splice(1, 0, `${key} = "${escaped}"`);
  return lines.join('\n');
}

function setJsoncField(block, key, value) {
  const escaped = value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  const fieldPattern = new RegExp(`("${key}"\\s*:\\s*")[^"]*(")`);
  if (fieldPattern.test(block)) {
    return block.replace(fieldPattern, `$1${escaped}$2`);
  }

  return block.replace(/\{\s*/, (match) => `${match}\n      "${key}": "${escaped}",`);
}

function extractTomlBlocks(configText, heading) {
  const blocks = [];
  const pattern = new RegExp(`\\[\\[${heading}\\]\\][\\s\\S]*?(?=\\n\\[\\[|\\n\\[[^\\[]|$)`, 'g');
  for (const match of configText.matchAll(pattern)) {
    blocks.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
    });
  }
  return blocks;
}

function extractJsoncArrayObjects(configText, key) {
  const arrayMatch = configText.match(new RegExp(`"${key}"\\s*:\\s*\\[([\\s\\S]*?)\\]`, 'm'));
  if (!arrayMatch || arrayMatch.index === undefined) {
    return [];
  }

  const arrayStart = arrayMatch.index + arrayMatch[0].indexOf(arrayMatch[1]);
  const objects = [];
  const objectPattern = /\{[\s\S]*?\}/g;
  for (const match of arrayMatch[1].matchAll(objectPattern)) {
    objects.push({
      start: arrayStart + match.index,
      end: arrayStart + match.index + match[0].length,
      text: match[0],
    });
  }

  return objects;
}

function getNamedResource(items, name) {
  return collectObjects(items).find((item) => (
    item.name === name
    || item.database_name === name
    || item.bucket === name
  ));
}

function readWranglerJson(args) {
  const output = runWrangler(args);
  return parseJsonOutput(output) ?? output;
}

function findD1Id(list, name) {
  const match = getNamedResource(list, name);
  return match
    ? String(match.uuid ?? match.id ?? match.database_id ?? findUuid(match) ?? '')
    : '';
}

function findR2Bucket(list, name) {
  if (typeof list === 'string') {
    return list
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .some((line) => line.split(/[^A-Za-z0-9_.-]+/).includes(name));
  }

  return Boolean(getNamedResource(list, name));
}

function isR2NotEntitledError(error) {
  if (!(error instanceof WranglerCommandError)) {
    return false;
  }

  const output = `${error.stdout}\n${error.stderr}`;
  return output.includes('[code: 10042]')
    || output.includes('Please enable R2 through the Cloudflare Dashboard')
    || output.includes('Account not entitled to this feature');
}

function ensureD1Database(configPath, databaseName) {
  const configArgs = ['--config', configPath];
  const existingList = readWranglerJson(['d1', 'list', '--json', ...configArgs]);
  const existingId = findD1Id(existingList, databaseName);
  if (existingId) {
    console.log(`D1 database exists: ${databaseName} (${existingId})`);
    return existingId;
  }

  console.log(`Creating D1 database: ${databaseName}`);
  const created = runWrangler(['d1', 'create', databaseName, ...configArgs]);
  let createdId = findUuid(created);
  if (!createdId) {
    const refreshedList = readWranglerJson(['d1', 'list', '--json', ...configArgs]);
    createdId = findD1Id(refreshedList, databaseName);
  }
  if (!createdId) {
    throw new Error(`Failed to read database_id for created D1 database ${databaseName}.`);
  }

  return createdId;
}

function ensureR2Bucket(configPath, bucketName) {
  const configArgs = ['--config', configPath];
  let existingList;
  try {
    existingList = readWranglerJson(['r2', 'bucket', 'list', ...configArgs]);
  } catch (error) {
    if (isR2NotEntitledError(error)) {
      throw new Error(
        [
          'Cloudflare R2 is not enabled for this account, so media buckets cannot be created yet.',
          'Open Cloudflare Dashboard -> R2 Object Storage once and enable R2, then rerun the deploy.',
          `After R2 is enabled, this script will create the bucket from wrangler.toml: ${bucketName}`,
        ].join('\n'),
      );
    }

    throw error;
  }

  if (findR2Bucket(existingList, bucketName)) {
    console.log(`R2 bucket exists: ${bucketName}`);
    return;
  }

  console.log(`Creating R2 bucket: ${bucketName}`);
  runWrangler(['r2', 'bucket', 'create', bucketName, ...configArgs]);
}

function applyReplacements(configText, replacements) {
  let next = configText;
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    next = `${next.slice(0, replacement.start)}${replacement.text}${next.slice(replacement.end)}`;
  }
  return next;
}

function ensureConfigResources(configPath) {
  const extension = path.extname(configPath);
  const isJsonConfig = extension === '.jsonc' || extension === '.json';
  let configText = readFileSync(configPath, 'utf8');
  const d1Blocks = isJsonConfig
    ? extractJsoncArrayObjects(configText, 'd1_databases')
    : extractTomlBlocks(configText, 'd1_databases');
  const r2Blocks = isJsonConfig
    ? extractJsoncArrayObjects(configText, 'r2_buckets')
    : extractTomlBlocks(configText, 'r2_buckets');
  const replacements = [];

  for (const block of d1Blocks) {
    const binding = getField(block.text, 'binding');
    const databaseName = getField(block.text, 'database_name');
    const databaseId = getField(block.text, 'database_id');
    if (!binding || !databaseName) {
      throw new Error(`D1 binding in ${configPath} must include binding and database_name.`);
    }

    const ensuredId = ensureD1Database(configPath, databaseName);
    if (!databaseId || databaseId === ZERO_UUID || databaseId !== ensuredId) {
      const nextBlock = isJsonConfig
        ? setJsoncField(block.text, 'database_id', ensuredId)
        : setTomlField(block.text, 'database_id', ensuredId);
      replacements.push({
        ...block,
        text: nextBlock,
      });
      console.log(`Linked D1 binding ${binding} to ${databaseName} (${ensuredId})`);
    }
  }

  for (const block of r2Blocks) {
    const bucketName = getField(block.text, 'bucket_name');
    const previewBucketName = getField(block.text, 'preview_bucket_name');
    if (bucketName) {
      ensureR2Bucket(configPath, bucketName);
    }
    if (previewBucketName) {
      ensureR2Bucket(configPath, previewBucketName);
    }
  }

  if (replacements.length > 0) {
    configText = applyReplacements(configText, replacements);
    writeFileSync(configPath, configText);
  }
}

function applyMigrations(configPath, bindings) {
  for (const binding of bindings) {
    console.log(`Applying D1 migrations for ${binding}`);
    runWrangler([
      'd1',
      'migrations',
      'apply',
      binding,
      '--remote',
      '--config',
      configPath,
    ]);
  }
}

const options = parseArgs(process.argv.slice(2));
const configPath = resolveConfigPath(options.config);

try {
  ensureConfigResources(configPath);
  applyMigrations(configPath, options.migrateBindings);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
