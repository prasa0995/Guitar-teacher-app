// Wraps the same Express app used for local dev (server/app.js) as a single
// Netlify Function. State is hydrated from Netlify Blobs before the request
// is handled and flushed back after — see server/store.js for why.
const serverless = require('serverless-http');
const { createApp } = require('../../server/app');
const store = require('../../server/store');

const app = createApp();
const handler = serverless(app);

exports.handler = async (event, context) => {
  await store.hydrate();
  const result = await handler(event, context);
  await store.flush();
  return result;
};
