# System Architecture & Design Patterns

## 🏗️ High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     USER INTERFACE LAYER                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐    │
│  │  Dashboard   │ │  AI Chat     │ │  Quote Builder       │    │
│  ├──────────────┤ ├──────────────┤ ├──────────────────────┤    │
│  │  Notes       │ │  Email       │ │  Material Estimator  │    │
│  ├──────────────┤ ├──────────────┤ ├──────────────────────┤    │
│  │  Settings    │ │  Onboarding  │ │  Rich Media          │    │
│  └──────────────┘ └──────────────┘ └──────────────────────┘    │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│                    REACT HOOKS LAYER                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  useAppIntegration      - Master hook                     │  │
│  │  usePersonalization     - User preferences               │  │
│  │  useAnalytics           - Engagement metrics             │  │
│  │  useResponsive          - Breakpoint detection           │  │
│  │  useDeviceUtilities     - Device-specific features       │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│                  BUSINESS LOGIC LAYER                            │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ businessProfileManager                                 │     │
│  │  - Business type registry (12 types)                  │     │
│  │  - Type-specific features factory                     │     │
│  │  - Material pricing defaults                          │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ aiAssistant                                            │     │
│  │  - Intent routing (9 handlers)                        │     │
│  │  - Context-aware responses                           │     │
│  │  - Conversation history                              │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ quotingSystem                                          │     │
│  │  - Measurement analysis                               │     │
│  │  - Line item generation                               │     │
│  │  - Material cost lookup                               │     │
│  │  - HTML/CSV export                                    │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ noteManager                                            │     │
│  │  - Note CRUD operations                               │     │
│  │  - Auto-tagging system                                │     │
│  │  - Full-text search                                   │     │
│  │  - Bidirectional linking                              │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ personalizationEngine                                  │     │
│  │  - User profile tracking                              │     │
│  │  - Feature adaptation                                 │     │
│  │  - Preference management                              │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ analyticsTracker                                       │     │
│  │  - Event tracking                                      │     │
│  │  - Engagement metrics                                 │     │
│  │  - Time series data                                   │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ Supporting Systems                                     │     │
│  │  - interactionTracker (user behavior)                 │     │
│  │  - aiScorer (recommendation scoring)                  │     │
│  │  - integration (system initialization)                │     │
│  └────────────────────────────────────────────────────────┘     │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│                  DATA PERSISTENCE LAYER                          │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ localStorage (Browser Storage)                         │     │
│  │  - quotes_${userId}                                    │     │
│  │  - notes_${userId}                                     │     │
│  │  - emails_${userId}                                    │     │
│  │  - estimates_${userId}                                 │     │
│  │  - businessProfile_${userId}                           │     │
│  │  - personalization_${userId}                           │     │
│  │  - analytics_${userId}                                 │     │
│  │  - interactions_${userId}                              │     │
│  └────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Design Patterns

### 1. **Singleton Pattern**
All business logic systems use singletons for consistency:

```typescript
// In businessProfile.ts
export const businessProfileManager = {
  profiles: new Map(),
  
  getOrCreateProfile(userId) {
    if (!this.profiles.has(userId)) {
      // Create once, reuse everywhere
    }
    return this.profiles.get(userId);
  }
}
```

**Benefits:**
- Single source of truth
- Consistent state
- Memory efficient
- Easy to track changes

### 2. **Factory Pattern**
Business-specific features generated dynamically:

```typescript
// businessProfileManager returns type-specific features
getBusinessTypeFeatures(type: BusinessType) {
  const features = {
    'carpentry': { materials: [...], calculations: [...] },
    'plumbing': { materials: [...], calculations: [...] },
    // ... 10 more types
  }
  return features[type];
}
```

**Benefits:**
- Scalable for new business types
- Encapsulated complexity
- Easy to maintain

### 3. **Hook Pattern (React)**
Abstraction layer for component integration:

```typescript
// useAppIntegration orchestrates multiple systems
export function useAppIntegration(userId: string) {
  return {
    trackUserAction,        // Combines analytics + personalization + interactions
    personalization,        // Access personalization engine
    analytics,             // Access analytics data
    interactions,          // Access interaction data
    getAppState,          // Get all system state
  }
}
```

**Benefits:**
- Clean component integration
- State management abstraction
- Reusable across components

### 4. **Intent Router Pattern**
AI system routes to specialized handlers:

```typescript
// aiAssistant analyzes message intent and routes appropriately
async function processMessage(message) {
  const intent = analyzeIntent(message); // bidding, materials, notes, etc.
  const handler = INTENT_HANDLERS[intent];
  return handler.execute(message, context);
}
```

**Benefits:**
- Extensible (add new intents easily)
- Specialized handling per intent
- Clear separation of concerns

### 5. **Observer Pattern**
Analytics tracks all system events:

```typescript
// Events flow through:
// User action → Integration.trackUserAction() 
//           → Triggers analytics observer
//           → Updates personalization observer
//           → Updates interactions observer
```

---

## 🔄 Data Flow Examples

### Example 1: Creating a Quote

```
User fills form (QuoteBuilder component)
    ↓
User clicks "Generate Quote"
    ↓
QuoteBuilder calls quotingSystem.createQuoteFromMeasurements()
    ↓
quotingSystem:
  1. Analyzes measurements (area = length × width)
  2. Gets business type from profile
  3. Looks up material costs for that type
  4. Creates line items with calculations
  5. Calculates tax and totals
    ↓
Returns Quote object with all data
    ↓
QuoteBuilder saves to localStorage
    ↓
Component displays quote
    ↓
useAppIntegration().trackUserAction() called
    ↓
Events tracked:
  - analytics: quote_generated
  - personalization: user prefers quotes feature
  - interactions: user_generated_quote
```

### Example 2: AI Chat Interaction

```
User types message in AIAssistantChat
    ↓
useAppIntegration().trackUserAction('user_message')
    ↓
aiAssistant.processMessage(message, userId)
    ↓
aiAssistant:
  1. Loads business context (profile type)
  2. Analyzes message keywords
  3. Routes to appropriate intent handler
  4. Handler processes in business context
  5. Generates response + suggestions + actions
    ↓
Returns AIResponse object
    ↓
Component displays message + suggestions
    ↓
useAppIntegration().trackUserAction('ai_response')
    ↓
Events tracked across 3 systems
```

### Example 3: Material Estimation

```
User enters project dimensions (MaterialEstimator)
    ↓
Automatic calculations:
  1. Area = length × width
  2. Volume = length × width × height
    ↓
User adds materials from presets
    ↓
Presets loaded based on business type:
  - Carpentry: 2x4, Lumber, Plywood prices
  - Plumbing: Pipe, Fittings, Valve prices
  - etc.
    ↓
User generates estimate
    ↓
System:
  1. Sums all materials
  2. Calculates tax
  3. Generates estimate
  4. Saves to localStorage
  5. Tracks analytics
    ↓
User can export as CSV
```

---

## 💾 Data Model Relationships

```
┌─────────────────────┐
│   BusinessProfile   │
├─────────────────────┤
│ businessType        │◄────┐
│ businessName        │     │ DEFINES TYPE
│ recommendedTools[]  │     │
└─────────────────────┘     │
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Quote        │  │ Note         │  │ Estimate     │
├──────────────┤  ├──────────────┤  ├──────────────┤
│ businessType │  │ tags         │  │ materials[]  │
│ lineItems[]  │  │ type         │  │ subtotal     │
│ totalAmount  │  │ linkedNotes[]│  │ tax          │
└──────────────┘  └──────────────┘  └──────────────┘
        │
        │ USES MATERIAL COSTS FROM
        ▼
┌──────────────────────────┐
│ Material Database        │
├──────────────────────────┤
│ (per business type)      │
│ carpentry: [...]         │
│ plumbing: [...]          │
│ electrical: [...]        │
└──────────────────────────┘
```

---

## 🎯 Core System Interfaces

### BusinessProfile
```typescript
interface BusinessProfile {
  userId: string;
  businessType: BusinessType;
  businessName: string;
  description: string;
  serviceArea: string;
  pricingStructure: 'hourly' | 'flat' | 'perUnit';
  baseRate: number;
  recommendedTools: string[];
  createdAt: number;
  updatedAt: number;
}
```

### AIResponse
```typescript
interface AIResponse {
  message: string;
  intent: IntentType;
  suggestions: string[];     // Quick action suggestions
  actions: string[];         // Actions UI can trigger
  data?: any;               // Additional data
  context: ConversationContext;
}
```

### Quote
```typescript
interface Quote {
  id: string;
  clientName: string;
  description?: string;
  lineItems: QuoteLineItem[];
  subtotal: number;
  tax: number;
  taxRate: number;
  totalAmount: number;
  createdAt: number;
}
```

### Note
```typescript
interface Note {
  id: string;
  title: string;
  content: string;
  type: NoteType;
  tags: string[];
  importance: 'low' | 'medium' | 'high';
  createdAt: number;
  updatedAt: number;
  linkedNotes?: string[];
  metadata?: any;
}
```

---

## 🚀 Scaling Considerations

### Adding New Business Type
1. Add to `BusinessType` enum
2. Add pricing/features in `businessProfileManager`
3. Add material presets if needed
4. Add to onboarding selections
5. Test quote generation

### Adding New Intent Handler
1. Create handler in `aiAssistant.ts`
2. Add pattern matching in `analyzeIntent()`
3. Add to `INTENT_HANDLERS` map
4. Test with sample messages
5. Update suggestions

### Adding New Feature
1. Create business logic in `lib/`
2. Add React component in `components/`
3. Integrate with `useAppIntegration` hook
4. Add analytics tracking
5. Add to sidebar navigation
6. Test on mobile

---

## 📊 State Management

### BusinessProfile State
- **Where stored:** businessProfileManager singleton + localStorage
- **When loaded:** On app init
- **When updated:** User completes onboarding or updates settings
- **Accessed by:** All business logic systems

### User Preferences
- **Where stored:** personalizationEngine + localStorage
- **When loaded:** On app init
- **When updated:** User changes settings
- **Accessed by:** Components via usePersonalization hook

### Analytics
- **Where stored:** analyticsTracker + localStorage
- **When updated:** Every trackUserAction call
- **Retention:** Last 30 days
- **Accessed by:** Dashboard stats, Analytics reports

### Quotes/Notes/Emails
- **Where stored:** localStorage only
- **How synced:** Save on create/update, load on component mount
- **Backup:** User can export JSON anytime
- **Restored:** localStorage persists across sessions

---

## 🔒 Security & Privacy

1. **No Server Communication**
   - All data stays in browser
   - No external API calls
   - No credentials needed

2. **localStorage Protection**
   - Limited to domain/origin
   - Can't be accessed cross-site
   - User can clear anytime

3. **Data Export**
   - Users can download all data
   - Portable JSON format
   - Full transparency

---

## 🎨 UI Architecture

### Component Hierarchy
```
App (Main orchestrator)
├── Sidebar (Navigation)
├── MainContent (Router)
│   ├── Dashboard
│   ├── AIAssistantChat
│   ├── QuoteBuilder
│   ├── NoteEditor
│   ├── EmailComposer
│   ├── MaterialEstimator
│   ├── UserPreferences
│   └── Progressiveonboarding
└── Modals/Overlays
```

### Styling Approach
- **CSS-in-JS** (styled-jsx for component isolation)
- **Responsive Design** (4 breakpoints)
- **Mobile-first** (smallest first, scale up)
- **Consistent Colors** (gradients, theme)
- **Accessible** (semantic HTML, ARIA labels)

---

## 🧪 Testing Considerations

### Unit Tests
- Business logic systems easily testable
- Pure functions in `lib/` files
- No dependencies on React

### Integration Tests
- Hook integration with components
- localStorage sync
- Cross-system communication

### E2E Tests
- User workflows (onboarding → quote generation)
- Mobile responsive behavior
- Data persistence

---

## 📈 Performance Optimization

### Current Optimizations
- ✅ Singleton pattern (no duplication)
- ✅ Lazy component loading
- ✅ localStorage caching
- ✅ Computed properties memoization
- ✅ CSS-in-JS minimal overhead

### Future Optimizations
- Consider: Virtual scrolling for long lists
- Consider: IndexedDB for large data sets
- Consider: Service Worker for offline
- Consider: Code splitting by route

---

## 🔧 Extensibility

### Easy to Extend
✅ Add business types
✅ Add AI intents
✅ Add email templates
✅ Add material categories
✅ Add analytics events

### Hard to Change
❌ Core data models (lots of dependencies)
❌ localStorage schema (migration needed)
❌ Hook API (components depend on it)

### Recommendations
- New features → New files in `lib/`
- UI changes → Update component files
- Schema changes → Add migration logic
- Breaking changes → Version carefully

---

## 📚 Development Workflow

### Adding a Feature

1. **Create business logic** (`lib/myFeature.ts`)
   ```typescript
   export const mySystem = {
     // Pure functions
     // Use other systems via imports
     // Save to localStorage internally
   }
   ```

2. **Create React component** (`components/MyFeature.tsx`)
   ```typescript
   import { useAppIntegration } from '@/lib/hooks'
   
   export function MyFeature({ userId }) {
     const integration = useAppIntegration(userId)
     // Use integration hooks
     // Track actions
   }
   ```

3. **Add to App** (`components/App.tsx`)
   ```typescript
   {currentView === 'feature' && <MyFeature userId={userId} />}
   ```

4. **Add navigation** (in sidebar)
   ```typescript
   <button onClick={() => setCurrentView('feature')}>
     My Feature
   </button>
   ```

5. **Test on mobile** - All breakpoints

6. **Deploy** - Build and deploy

---

This architecture ensures:
- ✅ **Scalability** - Easy to add new features
- ✅ **Maintainability** - Clear separation of concerns
- ✅ **Testability** - Logic separated from UI
- ✅ **Performance** - Optimized data flow
- ✅ **User Experience** - Responsive, fast, intuitive

