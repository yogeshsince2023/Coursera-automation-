const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', '.output', 'chrome-mv3');

function sanitizeFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Replace U+FFFF or other Unicode non-characters that trip Chrome's Windows UTF-8 validator
  // Specifically \uFFFF, \uFFFE, and any byte sequence that violates Chrome's StreamingUtf8Validator
  let replaced = content.replace(/[\uFFFF\uFFFE]/g, (ch) => {
    return '\\u' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');
  });

  fs.writeFileSync(filePath, replaced, 'utf8');
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.json') || entry.name.endsWith('.html')) {
      sanitizeFile(fullPath);
    }
  }
}

walkDir(outDir);
console.log('Sanitized all build output files for Chrome UTF-8 compliance.');

// Automatically synchronize compiled bundle to top-level extension/ folder for zero-setup installation
const extDir = path.join(__dirname, '..', 'extension');
if (fs.existsSync(outDir)) {
  fs.cpSync(outDir, extDir, { recursive: true, force: true });
  console.log('Synchronized production build to extension/ directory for direct loading.');
}

