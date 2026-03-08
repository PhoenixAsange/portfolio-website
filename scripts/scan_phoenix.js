#!/usr/bin/env node
/**
 * scripts/scan_phoenix.js
 *
 * Walks the local ./phoenix directory (relative to the repo root) and
 * produces a JSON array of FileEntry-like objects. This is a simple
 * Node-based scanner; it does not modify the browser code. The output
 * is written to ./assets/phoenix-files.json by default.
 */

const fs = require('fs').promises;
const fssync = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const TARGET = path.join(REPO_ROOT, 'phoenix');
const OUT = path.join(REPO_ROOT, 'assets', 'phoenix-files.json');

// Simple extension -> mime mapping for common text/binary types
const mimeMap = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf'
};

/**
 * Build a lightweight FileEntry object for a given path and stat.
 */
async function makeEntry(fullPath, stat){
  const rel = path.relative(REPO_ROOT, fullPath);
  const name = path.basename(fullPath);
  const ext = path.extname(name).toLowerCase();
  const isDirectory = stat.isDirectory();
  const entry = {
    path: '/' + rel.replace(/\\/g, '/'),
    name,
    isDirectory,
    size: isDirectory ? 0 : stat.size,
    mtime: stat.mtime.toISOString(),
    mimeType: isDirectory ? null : (mimeMap[ext] || 'application/octet-stream'),
    hash: null,
    mode: stat.mode,
    // content is omitted in the JSON dump; scanner can populate later if desired
    hasContent: false,
    children: isDirectory ? [] : null
  };

  // For small files, compute a sha1 hash to help identify content quickly
  if(!isDirectory && stat.size > 0 && stat.size <= 1_000_000){ // 1 MB limit
    try{
      const buf = await fs.readFile(fullPath);
      const sh = crypto.createHash('sha1').update(buf).digest('hex');
      entry.hash = sh;
      // we don't store content, but note that content is available
      entry.hasContent = true;
    } catch (err) {
      // ignore read errors but leave hash null
    }
  }

  return entry;
}

/**
 * Recursively walk a directory and populate entries array with FileEntry-like objects.
 */
async function walk(dir, outArray){
  const items = await fs.readdir(dir, { withFileTypes: true });
  for(const it of items){
    const full = path.join(dir, it.name);
    const stat = await fs.stat(full);
    const entry = await makeEntry(full, stat);
    outArray.push(entry);
    if(it.isDirectory()){
      // collect children recursively; for simplicity we keep a flat list
      // but also populate children array with relative names
      const children = [];
      const childItems = await fs.readdir(full, { withFileTypes: true });
      for(const child of childItems){
        children.push(child.name);
      }
      entry.children = children;
      // recurse deeper
      await walk(full, outArray);
    }
  }
}

async function main(){
  try{
    if(!fssync.existsSync(TARGET)){
      console.error('Target folder not found:', TARGET);
      process.exit(1);
    }

    const results = [];
    await walk(TARGET, results);

    // ensure output directory exists
    await fs.mkdir(path.dirname(OUT), { recursive: true });
    await fs.writeFile(OUT, JSON.stringify(results, null, 2), 'utf8');
    console.log('Wrote', OUT, 'with', results.length, 'entries');
  } catch (err){
    console.error('scan failed:', err);
    process.exit(2);
  }
}

if(require.main === module){
  main();
}
