const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const excelJsPath = path.join(path.dirname(require.resolve('exceljs')), 'dist', 'exceljs.min.js');
const requiredFiles = [
  'css/index.css',
  'html/index.html',
  'js/login.js',
  path.relative(root, excelJsPath)
];

for (const file of requiredFiles) {
  const absolutePath = path.join(root, file);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    throw new Error(`Required deployment asset was not found: ${file}`);
  }
}
