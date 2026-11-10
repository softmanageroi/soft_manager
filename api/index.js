const handler = require('../server');
const assets = require('./app-assets.generated.json');

module.exports = (request, response) => handler(request, response, assets);
