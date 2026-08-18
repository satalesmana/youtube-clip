// Minimal OpenAI-compatible stub that returns fixed research trends JSON.
// Used only for local end-to-end testing of the research pipeline.
import http from 'node:http';

const TRENDS = {
  trends: [
    {
      slug: 'openai-new-model',
      title: 'OpenAI releases new flagship model',
      summary: 'OpenAI dropped a new model topping benchmarks; tech Twitter is exploding.',
      score: 95,
      keywords: 'openai new model, openai benchmark',
      category: 'tech',
    },
    {
      slug: 'umkm-stimulus',
      title: 'Pemerintah umumkan stimulus UMKM baru',
      summary: 'Paket stimulus ekonomi baru untuk UMKM diumumkan pemerintah.',
      score: 80,
      keywords: 'stimulus umkm, kebijakan ekonomi',
      category: 'business',
    },
  ],
};

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        choices: [{ message: { role: 'assistant', content: JSON.stringify(TRENDS) } }],
      }),
    );
  });
});

server.listen(3999, '127.0.0.1', () => console.log('stub LLM on :3999'));
