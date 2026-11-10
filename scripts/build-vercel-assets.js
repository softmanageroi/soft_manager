const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const assets = {};

function addDirectory(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      addDirectory(absolutePath);
    } else if (entry.isFile()) {
      const key = path.relative(root, absolutePath).split(path.sep).join('/');
      assets[key] = fs.readFileSync(absolutePath).toString('base64');
    }
  }
}

addDirectory(path.join(root, 'html'));
addDirectory(path.join(root, 'js'));

const excelJsPackagePath = path.dirname(require.resolve('exceljs'));
const excelJsPath = path.join(excelJsPackagePath, 'dist', 'exceljs.min.js');
if (!fs.existsSync(excelJsPath)) {
  throw new Error(`ExcelJS browser bundle was not found at its resolved package location: ${excelJsPath}`);
}
assets['node_modules/exceljs/dist/exceljs.min.js'] = fs.readFileSync(excelJsPath).toString('base64');

fs.writeFileSync(
  path.join(root, 'api/app-assets.generated.json'),
  JSON.stringify(assets)
);
