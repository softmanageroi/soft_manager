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

const excelJsPath = path.join(root, 'node_modules/exceljs/dist/exceljs.min.js');
assets['node_modules/exceljs/dist/exceljs.min.js'] = fs.readFileSync(excelJsPath).toString('base64');

fs.writeFileSync(
  path.join(root, 'server/app-assets.generated.json'),
  JSON.stringify(assets)
);
