/**
 * Tailwind v4 Syntax Upgrade Script
 * Safely replaces deprecated class names with new canonical syntax
 */

const fs = require('fs');
const path = require('path');

// Patterns to replace
const replacements = [
  // flex-shrink-0 -> shrink-0
  { from: /flex-shrink-0/g, to: 'shrink-0' },
  // bg-gradient-to-X -> bg-linear-to-X
  { from: /bg-gradient-to-/g, to: 'bg-linear-to-' },
  // z-[9999] -> z-9999
  { from: /z-\[9999\]/g, to: 'z-9999' },
  { from: /z-\[9998\]/g, to: 'z-9998' },
  { from: /z-\[2000\]/g, to: 'z-2000' },
  { from: /z-\[1001\]/g, to: 'z-1001' },
  { from: /z-\[1000\]/g, to: 'z-1000' },
  { from: /z-\[999\]/g, to: 'z-999' },
  { from: /z-\[700\]/g, to: 'z-700' },
  { from: /z-\[600\]/g, to: 'z-600' },
  { from: /z-\[500\]/g, to: 'z-500' },
  { from: /z-\[9\]/g, to: 'z-9' },
  { from: /z-\[5\]/g, to: 'z-5' },
  { from: /z-\[2\]/g, to: 'z-2' },
];

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let changeCount = 0;

    for (const { from, to } of replacements) {
      const matches = content.match(from);
      if (matches) {
        changeCount += matches.length;
        content = content.replace(from, to);
      }
    }

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ ${filePath} (${changeCount} changes)`);
      return changeCount;
    }
    return 0;
  } catch (err) {
    console.error(`✗ Error processing ${filePath}: ${err.message}`);
    return 0;
  }
}

function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      walkDir(filePath, fileList);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

// Main
const srcDir = path.join(__dirname, '..', 'src');
const files = walkDir(srcDir);
let totalChanges = 0;
let filesChanged = 0;

console.log(`Processing ${files.length} files...\n`);

for (const file of files) {
  const changes = processFile(file);
  if (changes > 0) {
    totalChanges += changes;
    filesChanged++;
  }
}

console.log(`\n✅ Done! ${totalChanges} replacements in ${filesChanged} files.`);
