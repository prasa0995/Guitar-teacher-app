const { createApp } = require('./app');

const app = createApp();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`AI Guitar Teacher server running on http://localhost:${PORT}`);
  console.log(process.env.ANTHROPIC_API_KEY ? 'AI Tutor: Anthropic API enabled' : 'AI Tutor: rule-based engine (no ANTHROPIC_API_KEY set)');
});
