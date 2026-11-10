const fs = require('node:fs');
const path = require('node:path');
const handler = require('../server');

const assetsPath = path.join(__dirname, 'app-assets.generated.json');
const assets = fs.existsSync(assetsPath)
  ? require('./app-assets.generated.json')
  : null;

module.exports = (request, response) => handler(request, response, assets);
