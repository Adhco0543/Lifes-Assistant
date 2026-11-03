# Quick Start Guide

## ⚡ 5-Minute Setup

### 1. Install & Start
```bash
npm install
npm run dev
```
App opens at `http://localhost:3000`

### 2. First Time?
- App detects no profile
- Onboarding flow guides you through setup
- Select your business type (carpenter, plumber, etc.)
- Complete 7 steps
- Done!

### 3. Start Using
- **Dashboard** - See overview of your business
- **AI Chat** - Ask questions, get suggestions
- **Create Quote** - Generate professional bids
- **Take Notes** - Organize project info
- **Send Email** - Professional templates

---

## 🏗️ Basic Architecture

```
User (UI Component)
    ↓
React Hooks (useAppIntegration)
    ↓
Business Systems (profileManager, aiAssistant, etc.)
    ↓
localStorage
```

---

## 📝 Usage Examples

### Example 1: Using the AI Assistant
```typescript
import { aiAssistant } from '@/lib/aiAssistant';

const response = await aiAssistant.processMessage(
  "Create a quote for a 20x20 deck",
  userId
);

console.log(response.message);        // AI response
console.log(response.suggestions);    // ["View quote", "Edit materials", "Send to client"]
console.log(response.actions);        // ['generate_quote', 'save_estimate']
```

### Example 2: Creating a Quote
```typescript
import { quotingSystem } from '@/lib/quotingSystem';
import { businessProfileManager } from '@/lib/businessProfile';

const profile = businessProfileManager.loadProfile(userId);
const quote = quotingSystem.createQuoteFromMeasurements(
  "John Smith",
  profile,
  { length: 20, width: 20, height: 10, area: 400, volume: 4000 },
  { materials: "Premium wood" }
);

// quote now has:
// - lineItems (auto-generated materials)
// - total amount (calculated)
// - HTML export ready
```

### Example 3: React Component Usage
```typescript
import { useAppIntegration } from '@/lib/hooks';

function MyComponent({ userId }) {
  const integration = useAppIntegration(userId);

  const handleClick = () => {
    // This tracks the action across all systems (analytics, personalization, etc.)
    integration.trackUserAction('button_clicked', 'my_component', {
      customData: 'value'
    });
  };

  return <button onClick={handleClick}>Click me</button>;
}
```

### Example 4: Accessing User State
```typescript
import { useAppIntegration } from '@/lib/hooks';

function StatusComponent({ userId }) {
  const integration = useAppIntegration(userId);
  const state = integration.getAppState();

  return (
    <div>
      <p>User: {state.profile.businessName}</p>
      <p>Type: {state.profile.businessType}</p>
      <p>Quotes: {state.stats.quotesCreated}</p>
    </div>
  );
}
```

---

## 🎯 Common Tasks

### Task 1: Create a Business Profile
```typescript
import { businessProfileManager } from '@/lib/businessProfile';

const profile = businessProfileManager.createOrLoadProfile(
  'user-123',
  'carpentry'
);
```

### Task 2: Generate Materials Estimate
```typescript
// Automatic based on business type
// Carpentry: lumber calculation
// Plumbing: pipe sizing
// Electrical: wire gauge
// Auto-calculated from measurements
```

### Task 3: Export Quote as HTML
```typescript
import { quotingSystem } from '@/lib/quotingSystem';

const htmlString = quotingSystem.exportQuoteAsHTML(quote);
// Use to send via email or view in browser
```

### Task 4: Search Notes
```typescript
import { noteManager } from '@/lib/noteManager';

const results = noteManager.searchNotes("deck project");
const filtered = noteManager.filterByType('measurement');
```

### Task 5: Track User Action
```typescript
const integration = useAppIntegration(userId);
integration.trackUserAction(
  'feature_used',
  'feature_category',
  {
    customMetric: value,
    businessType: profile.businessType
  }
);
```

---

## 📊 Data Models

### Quote
```typescript
{
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
{
  id: string;
  title: string;
  content: string;
  type: 'general' | 'measurement' | 'specification' | 'idea' | 'client' | 'project';
  tags: string[];
  importance: 'low' | 'medium' | 'high';
  createdAt: number;
  updatedAt: number;
  linkedNotes?: string[];
  metadata?: any;
}
```

### Email
```typescript
{
  id: string;
  to: string;
  subject: string;
  body: string;
  template: string;
  createdAt: number;
  sentAt?: number;
  status: 'draft' | 'sent';
}
```

---

## 🔄 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│  User Interaction                                       │
│  (Click, Input, Submit, etc.)                           │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  React Component                                        │
│  (Dashboard, Chat, QuoteBuilder, etc.)                  │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  useAppIntegration Hook                                 │
│  (trackUserAction, getAppState, etc.)                   │
└────────────────────────┬────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
    Analytics      Personalization   BusinessLogic
    Tracker        Engine            (aiAssistant,
                                     quotingSystem,
                                     noteManager, etc.)
        │                │                │
        └────────────────┼────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  localStorage                                           │
│  (Data Persistence)                                     │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Environment Considerations
- No backend required (fully client-side)
- No API keys needed (no external integrations)
- No database required (uses localStorage)
- Works offline (all features work without internet)

### Browser Compatibility
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

---

## 🐛 Debugging

### Enable Debug Mode
```typescript
import { integration } from '@/lib/integration';

integration.debugMode = true; // Shows verbose console logs
```

### Check localStorage
```javascript
// In browser console:
localStorage.getItem('businessProfile_user-123')
localStorage.getItem('quotes_user-123')
localStorage.getItem('notes_user-123')
// etc...
```

### Clear Cache
```javascript
// In browser console:
localStorage.clear()
// Then refresh page
```

---

## 📚 Video Tutorials (Concepts)

Each component has built-in guides:
1. **Onboarding** - 7 steps, interactive setup
2. **Dashboard** - Quick tour of all features
3. **AI Chat** - Try saying: "How do I use this?"
4. **Quote Builder** - Clear form with examples
5. **Material Estimator** - Preset materials to learn from

---

## ⚙️ Configuration

### Change Business Type
1. Go to Settings
2. Edit Business Profile
3. Select new type
4. All features re-adapt automatically

### Customize Material Costs
Materials are auto-calculated based on business type, but you can manually override in Material Estimator.

### Email Templates
4 professional templates included:
- Quote follow-up
- Project update
- Invoice reminder
- Meeting invitation

---

## 📝 Notes for Developers

### Adding New Features
1. Create business logic in `lib/`
2. Integrate with hooks
3. Create UI component in `components/`
4. Add analytics tracking
5. Test on mobile

### Performance Tips
- Use React.memo for expensive components
- Debounce search/filter functions
- Lazy load components if needed

### Mobile Development
- Test at 375px width (iPhone)
- Test at 768px width (iPad)
- Use useResponsive hook for breakpoints

---

## 🆘 Support

### Common Issues

**Q: localStorage quota exceeded**
- A: Clear old estimates/emails first
- Check Settings → Export Data → Clean Up

**Q: App shows "Loading..." forever**
- A: Check browser console for errors
- Try clearing cache (Ctrl+Shift+Delete)

**Q: Quotes not generating**
- A: Ensure measurements are filled in
- Business type must be selected first

**Q: Mobile menu not working**
- A: Clear cache, refresh page
- Try different browser

---

## ✅ Checklist Before Going Live

- [ ] Test on mobile (iOS & Android)
- [ ] Test in different browsers
- [ ] Create test business profile
- [ ] Generate test quote
- [ ] Test email templates
- [ ] Clear localStorage after testing
- [ ] Verify all links work
- [ ] Check performance (< 3s load time)

---

## 🎯 Next Steps

1. **Explore the Dashboard** - See all available tools
2. **Complete Onboarding** - Set up your business
3. **Create Your First Quote** - Test the main feature
4. **Experiment with AI Chat** - Try different questions
5. **Check Settings** - Customize preferences

**You're ready to go!** 🚀

For detailed API documentation, see `API_REFERENCE.md`
For architecture deep-dive, see `ARCHITECTURE.md`
For complete feature list, see `FEATURES.md`
