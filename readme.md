# DevMind — AI-Powered Developer Knowledge Base

> Save anything. Query everything. Powered by RAG.

DevMind is a production-grade backend system that lets developers save resources — URLs, PDFs, text, code snippets — and query their entire knowledge base using natural language. Instead of searching through bookmarks, notes, and docs scattered everywhere, DevMind indexes everything and lets an LLM answer questions based only on what you've saved.

---

## The Problem It Solves

Developers constantly save things — Stack Overflow answers, documentation pages, blog posts, code snippets, research papers. But when you need something later, you can't find it. Search doesn't work well across different formats and sources.

DevMind fixes this by building a personal semantic search engine on top of your saved content. You ask a question in plain English, and it finds the most relevant content from everything you've saved and generates a direct answer.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (React)                           │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP Requests (JWT)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   EXPRESS REST API                              │
│                                                                 │
│   /api/auth        /api/resources      /api/query              │
│   /api/collections /api/resources/upload                       │
│                                                                 │
│   Middleware: JWT Auth → Zod Validation → Rate Limiting        │
└──────────┬──────────────────┬──────────────────────────────────┘
           │                  │
           ▼                  ▼
┌──────────────────┐  ┌──────────────────────────────────────────┐
│    MongoDB       │  │           BullMQ Queue                   │
│                  │  │                                          │
│  Users           │  │  job: { resourceId, userId }             │
│  Resources       │  └──────────────────┬───────────────────────┘
│  Collections     │                     │
└──────────────────┘                     ▼
                          ┌──────────────────────────────────────┐
                          │         BullMQ Worker                │
                          │                                      │
                          │  1. Fetch resource from MongoDB      │
                          │  2. Update status → "processing"     │
                          │  3. Extract content                  │
                          │     ├── URL → Cheerio scraper        │
                          │     ├── PDF → S3 download + parse    │
                          │     └── text/code → use directly     │
                          │  4. Chunk text (500 chars, 100 overlap)│
                          │  5. Embed chunks via Cohere API      │
                          │  6. Store vectors in Redis           │
                          │  7. Update status → "completed"      │
                          └──────────────────────────────────────┘
```

---

## RAG Pipeline — How It Works

RAG (Retrieval Augmented Generation) is the core of DevMind. It solves the fundamental problem with LLMs — they only know what they were trained on, not your private data.

### Ingestion Pipeline (when you save a resource)

```
User saves resource
        │
        ▼
Save to MongoDB (status: "pending")
        │
        ▼
Add job to BullMQ queue
        │
        ▼
Worker picks up job
        │
        ├──── type = "url"  ──────► Axios fetches page → Cheerio extracts text
        │
        ├──── type = "file" ──────► Download from S3 → pdf-parse extracts text
        │
        └──── type = "text"/"code" ──► Use content directly
                │
                ▼
        Chunk text into 500-character pieces
        with 100-character overlap between chunks
                │
                ▼
        Send chunks to Cohere Embed API
        Returns: array of 1024-dimensional vectors
                │
                ▼
        Store in Redis:
        key: chunk:{userId}:{resourceId}:{index}
        value: { text, embedding, resourceId, userId, title }
                │
                ▼
        Update MongoDB status → "completed"
        Store chunkCount
```

### Query Pipeline (when you ask a question)

```
User asks: "How does BullMQ handle retries?"
        │
        ▼
Embed question via Cohere API (inputType: "search_query")
Returns: 1024-dimensional vector
        │
        ▼
Fetch all chunk keys from Redis: chunk:{userId}:*
        │
        ▼
For each chunk:
  Calculate cosine similarity between
  question vector and chunk vector
        │
        ▼
Sort by similarity score
Take top 5 most relevant chunks
        │
        ▼
Build prompt:
  "Answer based ONLY on this context:
   Source 1: [chunk text]
   Source 2: [chunk text]
   ...
   Question: How does BullMQ handle retries?"
        │
        ▼
Send to Cohere LLM (command-r model)
        │
        ▼
Return answer to user
```

### Why Cosine Similarity?

Embeddings are vectors in high-dimensional space. Similar meaning = vectors pointing in a similar direction. Cosine similarity measures the angle between two vectors — smaller angle means more similar meaning. This works even when the user's question uses completely different words than the original content.

```
question vector:  [0.12, 0.87, 0.34, ...]
chunk 1 vector:   [0.11, 0.85, 0.36, ...]  → similarity: 0.98 ✅ very relevant
chunk 2 vector:   [0.91, 0.02, 0.77, ...]  → similarity: 0.31 ❌ not relevant
```

### Why Chunking?

You can't embed an entire document as one vector — too much information gets compressed and meaning is lost. Smaller chunks = more precise retrieval. The 100-character overlap prevents losing meaning at chunk boundaries.

```
Full text:  "...BullMQ uses Redis for job storage. Workers process jobs..."
                                    ↑ boundary
Chunk 1:    "...BullMQ uses Redis for job storage. Workers"          (500 chars)
Chunk 2:              "Redis for job storage. Workers process jobs..." (500 chars)
             ◄─── 100 char overlap ───►
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Runtime | Node.js | Non-blocking I/O, perfect for async-heavy workloads |
| Framework | Express.js | Minimal, flexible, production-proven |
| Database | MongoDB + Mongoose | Flexible schema for varied resource types |
| Queue | BullMQ + Redis | Reliable async job processing with retry support |
| Vector Store | Redis (JSON keys) | Fast, already in stack, no extra service needed |
| Embeddings | Cohere Embed v3 | Free tier, 1024-dim vectors, strong semantic quality |
| LLM | Cohere command-r | Free tier, good instruction following |
| File Storage | AWS S3 | Scalable, durable, production-standard |
| File Upload | Multer + multer-s3 | Streams directly to S3, no disk storage |
| PDF Parsing | pdf-parse | Extracts raw text from PDF buffers |
| URL Scraping | Axios + Cheerio | Fetches and parses HTML content |
| Validation | Zod | Schema-first validation, great TypeScript integration |
| Auth | JWT + bcrypt | Stateless auth, industry standard |
| Rate Limiting | Redis (incr + expire) | Atomic counter, automatic TTL reset |

---

## Folder Structure

```
devmind-backend/
├── app.js                      # Express app setup, route mounting
├── .env                        # Environment variables
│
├── config/
│   ├── db.js                   # MongoDB connection via Mongoose
│   └── redis.js                # ioredis client (Upstash TLS)
│
├── models/
│   ├── user.model.js           # User schema (name, email, hashed password)
│   ├── resource.model.js       # Resource schema (type, status, chunkCount...)
│   └── collection.model.js     # Collection schema (name, description, userId)
│
├── routes/
│   ├── auth.route.js           # POST /register, POST /login
│   ├── resource.route.js       # CRUD + /upload endpoint
│   ├── query.route.js          # POST /query
│   └── collection.route.js     # CRUD + /:id/resources
│
├── controllers/
│   ├── auth.controller.js      # signup, signIn
│   ├── resource.controller.js  # createResource, getResource, deleteResource
│   ├── query.controller.js     # query (full RAG pipeline)
│   └── collection.controller.js # createCollection, getCollection, deleteCollection, addResourcesToCollection
│
├── middleware/
│   ├── auth.middleware.js      # JWT verification, attaches req.user
│   ├── error.middleware.js     # Global async error handler
│   ├── upload.middleware.js    # Multer-S3 config, PDF filter
│   └── ratelimit.middleware.js # Redis-based rate limiter
│
├── queues/
│   └── resource.queue.js       # BullMQ Queue definition
│
├── workers/
│   └── resource.worker.js      # BullMQ Worker — full ingestion pipeline
│
└── services/
    ├── chunk.service.js        # Text chunking with overlap
    ├── embed.service.js        # Cohere embedding API calls
    └── similarity.service.js   # Cosine similarity calculation
```

---

## API Reference

### Auth

```
POST /api/auth/register
Body: { name, email, password }
Returns: { token, data: { name, email } }

POST /api/auth/login
Body: { email, password }
Returns: { token, data: { name, email } }
```

### Resources (all protected — requires Bearer token)

```
POST   /api/resources
Body: { type, title, content?, sourceUrl?, tags[] }
Returns: created resource, triggers background job

GET    /api/resources?page=1&limit=10
Returns: { data[], totalDocument, totalPage }

GET    /api/resources/:id
Returns: single resource

DELETE /api/resources/:id
Deletes from MongoDB + removes all Redis chunks

POST   /api/resources/upload
Form-data: { file (PDF), title }
Uploads to S3, triggers background job
```

### Query (protected)

```
POST /api/query
Body: { question }
Returns: { answer, message }

Rate limit: 20 queries per hour per user
```

### Collections (all protected)

```
POST   /api/collections
Body: { name, description }

GET    /api/collections
Returns: { collections[] }

DELETE /api/collections/:id

POST   /api/collections/:id/resources
Body: { resourceIds[] }
Assigns collectionId to all listed resources

GET    /api/collections/:id/resources
Returns: { resources[] } — all resources in this collection
```

---

## Queue Mechanisms

BullMQ handles all async processing. Four mechanisms are implemented:

```
┌─────────────────────────────────────────────────────────┐
│                    BullMQ Job Lifecycle                 │
│                                                         │
│  added → waiting → active → completed                   │
│                        └──► failed → retry (3 attempts) │
│                                  └──► delayed retry     │
└─────────────────────────────────────────────────────────┘
```

**1. Standard Processing** — resource saved → job added → worker processes immediately

**2. Retry on Failure** — if worker throws, BullMQ automatically retries up to 3 times

**3. Status Tracking** — MongoDB status field updated at each stage: pending → processing → completed/failed

**4. Job Events** — `worker.on("completed")` and `worker.on("failed")` log every job result

---

## Rate Limiting

Redis-based rate limiter using atomic `INCR` + `EXPIRE`:

```
Request comes in
      │
      ▼
INCR ratelimit:{userId}:{action}
      │
      ├── count === 1? → SET EXPIRE (24hr or 1hr)
      │
      ├── count > limit? → 429 Too Many Requests
      │
      └── count <= limit? → next() → continue
```

- Resource saves: 50 per day per user
- Queries: 20 per hour per user

The counter automatically resets when the TTL expires — no cron job needed.

---

## Security

- **Passwords** — bcrypt hashed with salt rounds of 10 before storage
- **JWT** — short-lived tokens signed with `JWT_SECRET` from environment
- **Route protection** — all resource/query/collection routes require valid JWT
- **User scoping** — every DB query filters by `userId` — users can only access their own data
- **Redis scoping** — chunk keys include `userId` — vector search is user-isolated
- **File validation** — Multer rejects non-PDF files before upload reaches S3
- **Input validation** — Zod validates all request bodies before controller runs

---

## Environment Variables

```
PORT=3000
MONGO_URI=mongodb+srv://...
JWT_SECRET=your-secret-key

REDIS_HOST=your-endpoint.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-password

AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_BUCKET_NAME=devminds

COHERE_API_KEY=your-cohere-key
```

---

## Local Setup

```bash
# Clone the repo
git clone https://github.com/KrParshuram/devmind-backend
cd devmind-backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Fill in your values

# Start the server (worker starts automatically)
npm run dev
```

---

## What I Built and Learned

This project was built entirely from scratch without AI-generated code — every line written, debugged, and understood manually.

**Backend concepts implemented from scratch:**
- JWT authentication flow — register, login, token verification middleware
- BullMQ job queue with worker — async processing pipeline
- RAG pipeline — chunking, embedding, vector storage, cosine similarity, LLM generation
- Redis rate limiting using atomic INCR operations
- S3 file upload using multer-s3 — streaming directly to cloud storage
- PDF text extraction from S3 URLs — download stream → Buffer → Uint8Array → parse
- URL content scraping using Cheerio
- Global async error handler — catches all thrown errors across the app
- Zod request validation middleware
- User-scoped data isolation across MongoDB and Redis

**Key decisions made:**
- Used Redis for both the job queue (BullMQ) and vector storage — keeping the stack lean without adding a dedicated vector database
- Chose Cohere over OpenAI for embeddings — free tier sufficient for development, 1024-dim vectors with strong semantic quality
- Stored embeddings as Redis JSON keys instead of a vector DB — simpler architecture, fast enough for personal knowledge bases
- Implemented overlap in chunking — prevents context loss at chunk boundaries which would break semantic search quality

---

## Future Roadmap

- [ ] WebSocket/SSE for streaming LLM responses
- [ ] Google Drive OAuth integration — auto-index Drive files
- [ ] General AI chat mode — without knowledge base context
- [ ] Chat history per user — saved conversations
- [ ] Docker + docker-compose setup
- [ ] Deploy on AWS EC2 with Nginx reverse proxy
- [ ] Subscription tiers — free vs pro usage limits
- [ ] GitHub repo integration — index code from repos