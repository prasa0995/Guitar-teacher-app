// Wraps the same Express app used for local dev (server/app.js) as a single
// Netlify Function. State is hydrated from Netlify Blobs before the request
// is handled and flushed back after — see server/store.js for why.
const serverless = require('serverless-http');
const { connectLambda } = require('@netlify/blobs');
const { createApp } = require('../../server/app');
const store = require('../../server/store');

const app = createApp();
const handler = serverless(app);

exports.handler = async (event, context) => {
  // Netlify injects blob credentials into the raw Lambda-style event
  // (event.blobs) rather than plain env vars — connectLambda() is what
  // actually wires @netlify/blobs up to use them. Without this call,
  // getStore() throws MissingBlobsEnvironmentError even in production.
  try {
    connectLambda(event);
  } catch (err) {
    console.error('connectLambda failed (Blobs context unavailable for this invocation):', err.message);
  }
  await store.hydrate();
  const result = await handler(event, context);
  await store.flush();
  return result;
};
