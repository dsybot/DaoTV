# LunaTV AI Features Documentation

## 📚 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Admin Configuration](#admin-configuration)
- [User Guide](#user-guide)
- [Technical Details](#technical-details)
- [FAQ](#faq)

---

## Overview

LunaTV's AI features provide intelligent movie/TV show recommendations and context-aware conversations powered by OpenAI-compatible APIs with optional web search capabilities.

### What's New

✨ **5 Major AI Enhancements:**

1. **Markdown Rendering** - Professional formatting with code highlighting, links, and lists
2. **AI Orchestrator** - Intelligent intent analysis with automatic web search
3. **Video Context** - Context-aware conversations about specific movies/shows
4. **Smart UI Integration** - AI buttons on video cards with smart positioning
5. **Streaming Responses** - Real-time, character-by-character AI responses

---

## Features

### 1. Markdown Rendering

AI responses now support GitHub-flavored Markdown with:
- **Code blocks** with syntax highlighting
- **Links** that are clickable
- **Lists** (ordered and unordered)
- **Bold/Italic** text formatting
- **Tables** for structured data

### 2. AI Orchestrator (Smart Coordination)

The orchestrator automatically analyzes user intent and decides whether to search the web for latest information.

**Intent Types:**
- `recommendation` - Movie/show recommendations
- `query` - Actor/director information, news
- `detail` - Plot, reviews, ratings
- `general` - Other questions

**Auto Web Search Triggers:**
- Time-sensitive keywords (最新, 今年, 2024, 2025, 即将, 上映, etc.)
- Actor/director queries (演员, 导演, 主演, etc.)
- News requests (新闻, 消息, 官宣, etc.)

**Supported Search Provider:**
- **Tavily** - 1000 free API calls/month per key

### 3. Video Context Support

When using AI from a video card, the AI automatically knows:
- Movie/show title
- Release year
- Type (movie/tv)
- Current episode (for TV shows)
- Douban ID / TMDB ID

**Benefits:**
- No need to repeat the movie name
- More accurate responses
- Natural conversation flow
- Targeted web searches

### 4. Smart VideoCard AI Button

**Desktop Experience:**
- Hover over any video card
- AI button appears at bottom-center
- Smart positioning: avoids overlapping with badges
- Glass-morphism design with gradient colors

**Mobile Experience:**
- Long-press or right-click video card
- Select "AI问片" from action menu
- Full-screen AI chat dialog

### 5. Streaming Responses

Real-time character-by-character display of AI responses for:
- Better user experience
- Immediate feedback
- Reduced perceived latency

---

## Admin Configuration

### Basic AI Settings

Navigate to: **Admin Panel → AI推荐配置**

| Setting | Description | Default |
|---------|-------------|---------|
| **Enable AI** | Master switch for AI features | `false` |
| **API URL** | OpenAI-compatible API endpoint | `https://api.openai.com/v1` |
| **API Key** | Your API key | (required) |
| **Model** | Model name (e.g., gpt-4, gpt-3.5-turbo) | `gpt-3.5-turbo` |
| **Temperature** | Response randomness (0-2) | `0.7` |
| **Max Tokens** | Maximum response length | `3000` |

### Orchestrator Settings (Advanced)

Expand: **智能协调器设置（高级）**

#### Enable Orchestrator
Toggle to enable intent analysis and auto web search.

#### Enable Web Search
Requires orchestrator to be enabled. When enabled, AI will automatically search the web for time-sensitive queries.

#### Tavily API Keys (Multi-Key Support)

**Why Multiple Keys?**
- Each Tavily account provides **1000 free API calls/month**
- Configure multiple keys to increase quota
- Example: 5 keys = 5000 free calls/month

**How to Get Tavily API Keys:**

1. Visit [https://tavily.com](https://tavily.com)
2. Sign up for a free account (no credit card required)
3. Get your API key from dashboard
4. Repeat with multiple email addresses for more keys

**Configuration:**
```
Enter one API key per line:
tvly-xxxxxxxxxxxxxx
tvly-yyyyyyyyyyyyyy
tvly-zzzzzzzzzzzzzz
```

**Key Rotation:**
- System automatically rotates through available keys
- Failed keys are marked and skipped
- Automatic retry with next key on 401/429 errors

---

## User Guide

### Using Global AI Button

**Location:** Top-right corner (desktop) or top bar (mobile)

**Steps:**
1. Click the AI button (⭐ Sparkles icon)
2. Type your question
3. Press Enter or click Send
4. View streaming response

**Example Questions:**
- "推荐一些高分科幻电影"
- "2025年有什么新上映的电影？"
- "诺兰的电影有哪些？"

### Using AI on Video Cards

**Desktop:**
1. Hover over any movie/show card
2. AI button appears at bottom-center
3. Click to open AI chat
4. AI already knows which movie you're asking about

**Mobile:**
1. Long-press or right-click the video card
2. Select "AI问片" from menu
3. AI chat opens with context

**Example Context-Aware Questions:**
- "这部讲什么？" → AI knows you're asking about that specific movie
- "评分怎么样？"
- "有续集吗？"
- "演员阵容如何？"

### Quick Action Buttons

When AI chat opens with video context, you'll see quick action buttons:
- 📖 **剧情介绍** - Get plot summary
- 🎬 **推荐高分电影** - General recommendations
- 🆕 **最新上映** - Latest releases

---

## Technical Details

### Streaming Implementation

**Backend (SSE):**
```typescript
// API returns Server-Sent Events stream
Content-Type: text/event-stream
data: {"text": "Hello"}
data: {"text": " World"}
data: [DONE]
```

**Frontend:**
```typescript
// Client receives chunks in real-time
sendAIRecommendMessage(messages, context, (chunk) => {
  // Update UI with each chunk
  streamingContent += chunk;
});
```

### Intent Analysis Algorithm

**Keyword Matching:**
- Time keywords: 最新, 今年, 2024, 2025, 即将, 上映
- Person keywords: 演员, 导演, 主演, 作品
- News keywords: 新闻, 消息, 官宣, 定档

**Decision Logic:**
```typescript
needWebSearch = hasTimeKeyword ||
                hasPersonKeyword ||
                hasNewsKeyword ||
                (hasRecommendKeyword && hasTimeKeyword);
```

### API Key Rotation

**Rotation Strategy:**
```typescript
class ApiKeyRotator {
  - Maintains list of available keys
  - Tracks failed keys
  - Round-robin selection from available keys
  - Auto-reset when all keys exhausted
}
```

**Failover Process:**
1. Try first key
2. If 401/429 error → mark as failed
3. Try next available key
4. Repeat until success or all keys exhausted

### Video Context Structure

```typescript
interface VideoContext {
  title?: string;           // "流浪地球2"
  year?: string;            // "2023"
  douban_id?: number;       // 26266893
  tmdb_id?: number;         // 550988
  type?: 'movie' | 'tv';    // "movie"
  currentEpisode?: number;  // 5 (for TV shows)
}
```

**System Prompt Enhancement:**
```
## 【当前视频上下文】
用户正在浏览: 流浪地球2 (2023)
```

---

## FAQ

### Q: How many free API calls can I get from Tavily?

**A:** Each Tavily account provides **1000 free API calls per month**. You can register multiple accounts with different email addresses and configure all keys in LunaTV for automatic rotation.

**Example:**
- 1 key = 1,000 calls/month
- 5 keys = 5,000 calls/month
- 10 keys = 10,000 calls/month

### Q: What happens when a Tavily key runs out of quota?

**A:** The system automatically:
1. Detects 429 (rate limit) error
2. Marks the key as failed
3. Switches to the next available key
4. Continues the request seamlessly

### Q: Do I need to configure Tavily for AI to work?

**A:** No. Tavily is **optional** and only needed for web search features. Basic AI recommendations work without it. However, for time-sensitive questions (e.g., "2025年最新电影"), web search provides more accurate results.

### Q: What's the difference between using AI globally vs. on a video card?

**A:**

| Feature | Global AI Button | VideoCard AI Button |
|---------|------------------|---------------------|
| Context | None | Movie/show info |
| Questions | General | Context-aware |
| Example | "推荐科幻电影" | "这部讲什么？" |
| Web Search | General search | Targeted search |

### Q: Can I use Claude API instead of OpenAI?

**A:** Yes! Any OpenAI-compatible API works, including:
- OpenAI GPT-3.5/GPT-4
- Claude (via compatible proxy)
- Local models (Ollama, LM Studio)
- Other providers (Groq, Together.ai, etc.)

Just configure the API URL and key accordingly.

### Q: Why is the AI button not showing on video cards?

**A:** Check:
1. ✅ AI feature is enabled in admin panel
2. ✅ Valid API key is configured
3. ✅ On desktop, hover over the card (mobile: long-press)
4. ✅ The video has a title (required for context)

### Q: How does smart positioning work?

**A:** The AI button automatically adjusts its position:
- **Has bottom badges** (已完结, 已上映, etc.) → Button moves up (bottom-14)
- **No bottom badges** → Button stays near bottom (bottom-4)
- **Prevents overlap** with existing UI elements

### Q: Can I disable streaming responses?

**A:** Currently, streaming is enabled by default for better UX. To use non-streaming mode, you would need to modify the frontend code to not pass the streaming callback.

### Q: How is my data stored?

**A:**
- Conversation history is cached in **browser localStorage** for 30 minutes
- Server does **not** store chat history
- Only the latest request is cached for 5 minutes (simple queries only)
- Context data (movie info) is sent per-request, not stored

---

## Support

For issues or feature requests, please:
1. Check this documentation
2. Review admin panel settings
3. Check browser console for errors
4. Contact your administrator

---

**Last Updated:** 2025-12-29
**Version:** 5.9.0
