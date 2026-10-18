import fs from 'fs';
import path from 'path';

function walk(dir) {
  let files = [];
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      if (item !== 'node_modules' && item !== '.next') files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

const allFiles = walk('./src').filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));

for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  const matches = content.match(/useState\s*(<[^>]+>)?\s*\([^)]*\)/g);
  if (matches) {
    const suspicious = matches.filter(m => {
      const clean = m.replace(/\s+/g, '');
      return !clean.includes('useState(false)') &&
             !clean.includes('useState(true)') &&
             !clean.includes('useState(null)') &&
             !clean.includes("useState('')") &&
             !clean.includes('useState("")') &&
             !clean.includes('useState(0)') &&
             !clean.includes('useState([])') &&
             !clean.includes('useState(1)') &&
             !clean.includes('useState(undefined)');
    });
    if (suspicious.length > 0) {
      console.log('File:', file);
      suspicious.forEach(s => console.log('   ->', s));
    }
  }
}
