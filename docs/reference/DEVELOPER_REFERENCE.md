# Developer Quick Reference Guide

## Quick Links

| Component | Location | Purpose |
|-----------|----------|---------|
| AdvancedConversationalChat | `components/AdvancedConversationalChat.tsx` | Main chat UI with database |
| AuthForm | `components/AuthForm.tsx` | Login/signup UI |
| RealAI Service | `lib/realAI.ts` | OpenAI/Anthropic integration |
| Firebase Backend | `lib/firebaseBackend.ts` | Database & auth layer |
| Intelligence Engine | `lib/intelligenceEngine.ts` | Analytics & insights |

---

## Using the Chat Component

### Basic Usage
```typescript
import AdvancedConversationalChat from '@/components/AdvancedConversationalChat';

<AdvancedConversationalChat 
  businessContext="construction"
  fullScreen={false}
  onClose={() => setChatOpen(false)}
/>
```

### In Fullscreen
```typescript
<AdvancedConversationalChat 
  businessContext="plumbing"
  fullScreen={true}
/>
```

### Props
```typescript
interface AdvancedChatProps {
  businessContext?: string;    // User's business type
  onClose?: () => void;        // Called when closing
  fullScreen?: boolean;        // Fullscreen vs floating
}
```

---

## Using the AI Service

### Send a Message
```typescript
import { realAI } from '@/lib/realAI';

const response = await realAI.sendMessage(
  "Create a quote for 2-bed kitchen remodel",
  "construction" // businessContext
);
console.log(response); // AI response string
```

### Get Conversation History
```typescript
const history = realAI.getConversationHistory();
// Returns: { role: 'user'|'assistant', content: string }[]
```

### Clear History
```typescript
realAI.clearConversationHistory();
```

### Mock Mode (for testing without API key)
```typescript
// Set environment variable:
NEXT_PUBLIC_OPENAI_API_KEY="" // Empty = mock mode
```

---

## Using Firebase Backend

### Initialize
```typescript
import { firebaseBackend } from '@/lib/firebaseBackend';

await firebaseBackend.initialize();
```

### Authentication

**Sign Up**
```typescript
const user = await firebaseBackend.signUp(
  "user@example.com",
  "password123",
  "John Doe"
);
```

**Login**
```typescript
const user = await firebaseBackend.login(
  "user@example.com",
  "password123"
);
```

**Logout**
```typescript
await firebaseBackend.logout();
```

**Get Current User**
```typescript
const user = firebaseBackend.getCurrentUser();
if (user) {
  console.log(user.uid, user.email);
}
```

### Message Operations

**Save Message**
```typescript
await firebaseBackend.saveMessage({
  id: "msg-123",
  userId: "user-456",
  conversationId: "conv-789",
  role: "user",
  content: "Hello AI",
  timestamp: Date.now()
});
```

**Get Messages**
```typescript
const messages = await firebaseBackend.getMessages(
  "conversation-id",
  100 // limit
);
```

**Search Messages**
```typescript
const results = await firebaseBackend.searchMessages(
  "quote", // search term
  10 // limit
);
```

### Conversation Operations

**Create Conversation**
```typescript
const convId = await firebaseBackend.createConversation(
  "Project: Kitchen Remodel",
  "construction"
);
```

**Get Conversations**
```typescript
const conversations = await firebaseBackend.getConversations();
```

**Real-time Listener**
```typescript
const unsubscribe = firebaseBackend.onConversationsChange(
  (conversations) => {
    console.log("Conversations updated:", conversations);
  }
);

// Clean up when component unmounts
useEffect(() => {
  return unsubscribe;
}, []);
```

### Analytics

**Track Event**
```typescript
await firebaseBackend.trackEvent('quote_created', {
  client: 'John Doe',
  amount: 5000
});
```

---

## Using Intelligence Engine

### Analyze Conversations
```typescript
import { intelligenceEngine } from '@/lib/intelligenceEngine';

const insights = intelligenceEngine.analyzeConversations(
  messages,  // ChatMessage[]
  conversations  // Conversation[]
);

// insights is BusinessInsight[]
insights.forEach(insight => {
  console.log(insight.title);
  console.log(insight.description);
  console.log(insight.confidence); // 0-1
});
```

### Calculate Business Metrics
```typescript
const metrics = intelligenceEngine.calculateMetrics(
  messages,
  conversations
);

console.log({
  totalMessages: metrics.totalMessages,
  quotesCreated: metrics.quotesCreated,
  estimatedBusinessValue: metrics.estimatedBusinessValue
});
```

### Analyze User Behavior
```typescript
const behavior = intelligenceEngine.analyzeBehaviorPattern(messages);

console.log({
  mostActiveTime: behavior.mostActiveTime,
  engagementLevel: behavior.engagementLevel, // 'high'|'medium'|'low'
  growthTrend: behavior.growthTrend  // 'increasing'|'stable'|'declining'
});
```

---

## Environment Variables

### Create `.env.local`
```bash
# AI Provider (choose one)
NEXT_PUBLIC_OPENAI_API_KEY=sk-...
# OR
NEXT_PUBLIC_ANTHROPIC_API_KEY=sk-...
NEXT_PUBLIC_AI_PROVIDER=anthropic

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=project-123
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123def456
```

---

## Type Definitions

### ChatMessage
```typescript
interface ChatMessage {
  id: string;
  userId: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number; // Unix timestamp
  tags?: string[];
  archived?: boolean;
}
```

### Conversation
```typescript
interface Conversation {
  id: string;
  userId: string;
  title: string;
  businessContext?: string;
  messageCount: number;
  tags?: string[];
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
}
```

### BusinessInsight
```typescript
interface BusinessInsight {
  type: 'opportunity' | 'pattern' | 'recommendation' | 'warning' | 'achievement';
  title: string;
  description: string;
  actionable: boolean;
  action?: string;
  confidence: number; // 0-1
  relatedConversations?: string[];
}
```

### BusinessMetrics
```typescript
interface BusinessMetrics {
  totalMessages: number;
  totalConversations: number;
  averageResponseTime: number;
  busyHours: Record<string, number>;
  topicFrequency: Record<string, number>;
  quotesCreated: number;
  projectsTracked: number;
  estimatedBusinessValue: number;
}
```

### UserBehavior
```typescript
interface UserBehavior {
  mostActiveTime: string;
  averageSessionLength: number;
  responseStyle: 'brief' | 'detailed' | 'mixed';
  preferredTopics: string[];
  engagementLevel: 'high' | 'medium' | 'low';
  growthTrend: 'increasing' | 'stable' | 'declining';
}
```

---

## Common Tasks

### Show Loading State
```typescript
const [isLoading, setIsLoading] = useState(false);

setIsLoading(true);
// ... do async work ...
setIsLoading(false);
```

### Display Error Message
```typescript
const [error, setError] = useState('');

try {
  // ... async operation ...
} catch (err) {
  setError(err instanceof Error ? err.message : 'Unknown error');
}
```

### Update UI When Data Changes
```typescript
useEffect(() => {
  const unsubscribe = firebaseBackend.onConversationsChange(
    (conversations) => {
      setConversations(conversations);
    }
  );

  return unsubscribe;
}, []);
```

### Auto-scroll to Latest Message
```typescript
const messagesEndRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages]);

// In JSX:
<div ref={messagesEndRef} />
```

---

## Debugging

### Check Firebase Connection
```typescript
console.log('Firebase available:', firebaseBackend.isAvailable());
console.log('Current user:', firebaseBackend.getCurrentUser());
```

### Check AI Service
```typescript
const mockResponse = await realAI.sendMessage(
  "Test message",
  "test"
);
console.log('AI works:', !!mockResponse);
```

### View Browser Storage
```javascript
// In browser console:
console.log(localStorage.getItem('conversationHistory'));
```

### Check Build Errors
```bash
npm run build 2>&1 | grep -i error
```

---

## Deployment

### Build for Production
```bash
npm run build
```

### Start Production Server
```bash
npm start
```

### Deploy to Vercel
```bash
vercel deploy --prod
```

### Deploy to Netlify
```bash
netlify deploy --prod --dir=.next
```

---

## Performance Tips

1. **Use Real-time Listeners Carefully**: Each listener costs bandwidth
2. **Limit Message History**: Only load last 100 messages initially
3. **Debounce Search**: Don't search on every keystroke
4. **Cache Insights**: Re-run IntelligenceEngine only when needed
5. **Lazy Load Components**: Code-split heavy components

---

## Security Best Practices

1. **Never log API keys**: Stripe console logs
2. **Use .env.local**: Never commit to git
3. **Validate inputs**: Sanitize user messages
4. **Rate limit**: Add backoff for API calls
5. **Update security rules**: Switch from Test Mode in production

---

## Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Anthropic API Reference](https://docs.anthropic.com)

---

## Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Firebase not initialized" | Firebase SDK not loaded | Add env variables, restart server |
| "API key invalid" | Wrong/expired API key | Check .env.local, regenerate key |
| "No internet" | Network error | Check connection, try again |
| "Auth error" | User not logged in | Show login screen |
| "Message not saved" | Firebase rules block write | Check Firestore security rules |

---

## Next Steps

1. ✅ Complete COMPLETE_SETUP.md
2. ✅ Test authentication with AuthForm
3. ✅ Send test message with realAI
4. ✅ Verify message saves to Firestore
5. ✅ Open in two tabs to test sync
6. ✅ Check insights after 5+ messages
7. ✅ Deploy to production

---

**Happy coding!** 🚀
