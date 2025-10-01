# Chatbot Backend API

Production-ready chatbot backend with Fastify and TypeScript, featuring German telecommunications FAQ support.

## Features

- 🚀 **Fast & Lightweight**: Built with Fastify framework
- 📝 **TypeScript**: Full type safety and better developer experience  
- 🔍 **Smart Search**: Keyword-based FAQ matching with confidence scoring
- 📊 **Structured Logging**: Using Pino for performance logging
- ✅ **Input Validation**: Zod schemas for request/response validation
- 🧪 **Testing**: Comprehensive test suite with Vitest
- 🐳 **Docker Ready**: Multi-stage Docker build for production
- 🔧 **Environment Configuration**: Flexible config with .env support

## API Endpoints

### Health Check
```
GET /health
```
Returns server status and version information.

### Chat Answer
```
POST /api/answer
Content-Type: application/json

{
  "question": "What is your refund policy?"
}
```

Response:
```json
{
  "answer": "We offer a 30-day money-back guarantee...",
  "confidence": 0.95
}
```

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Development Mode**
   ```bash
   npm run dev
   ```

4. **Production Build**
   ```bash
   npm run build
   npm start
   ```

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript  
- `npm start` - Start production server
- `npm test` - Run test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

### Project Structure

```
src/
├── server.ts              # Server entry point
├── app.ts                 # Fastify app configuration  
├── models/
│   └── faq.model.ts       # Data models and schemas
├── routes/
│   ├── health.routes.ts   # Health check routes
│   └── chatbot.routes.ts  # Chat API routes
├── controllers/
│   ├── health.controller.ts
│   └── chatbot.controller.ts
├── services/
│   └── chatbot.service.ts # Business logic
├── repos/
│   └── faq.repository.ts  # Data access layer
├── data/
│   └── faqs.json          # FAQ data source
└── tests/
    ├── faq.repository.test.ts
    └── chatbot.service.test.ts
```

### Adding New FAQs

Edit `src/data/faqs.json` to add new questions and answers:

```json
{
  "id": "unique-id",
  "title": "Main question title",
  "synonyms": ["alternative phrase", "another way to ask"],
  "answer": "The answer to provide"
}
```

### Testing

Run the test suite:
```bash
npm test
```

Run with coverage:
```bash
npm run test:coverage
```

The API endpoints are also testable via curl:

```bash
# Health check
curl http://localhost:3001/health

# Ask a question
curl -X POST http://localhost:3001/api/answer \
  -H "Content-Type: application/json" \
  -d '{"question": "What is your refund policy?"}'
```

## Docker Deployment

### Build and Run

```bash
# Build image
docker build -t chatbot-backend .

# Run container
docker run -p 3001:3001 chatbot-backend
```

### Using Docker Compose

```bash
docker-compose up -d
```

## Configuration

Environment variables (see `.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `3001` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `LOG_LEVEL` | `info` | Logging level |

## Architecture

### Search Algorithm

The chatbot uses a simple keyword-based search with confidence scoring:

1. **Keyword Extraction**: Split question into words (>2 chars)
2. **Title Matching**: Direct and partial matches in FAQ titles
3. **Synonym Matching**: Check against alternative phrases
4. **Confidence Scoring**: Based on match quality and relevance
5. **Result Ranking**: Return best match with confidence score

### Error Handling

- Input validation with detailed error messages
- Graceful degradation for search failures
- Structured error responses
- Request logging for debugging

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality  
5. Run the test suite
6. Submit a pull request

## License

MIT License - see LICENSE file for details.
