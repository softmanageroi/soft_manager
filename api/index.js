module.exports = async function handler(request, response) {
  try {
    const { vercelHandler } = require('../server');
    await vercelHandler(request, response);
  } catch (error) {
    console.error('Vercel function bootstrap failed.', error);
    if (!response.headersSent) {
      response.statusCode = 500;
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({ error: 'The application function could not start.' }));
    } else {
      response.destroy();
    }
  }
};
