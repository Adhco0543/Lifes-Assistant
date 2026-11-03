# ⚡ Quick Reference Guide

## 🎯 Core Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

## 🎨 Using the New Components

### Dark Mode
```typescript
// Automatic - just import and use
import { PageWithTheme } from './components/PageWithTheme';
<PageWithTheme userId="user-id" />
// Theme switcher appears automatically in top-right
```

### AI Suggestions
```typescript
import { SuggestionsWidget } from './components/SuggestionsWidget';
<SuggestionsWidget userId="user-id" businessType="plumbing" />
```

### Background Visuals
```typescript
import { HeroBackground } from './components/BackgroundVisuals';
<HeroBackground theme="professional" height="350px">
  <h1>Your Content Here</h1>
</HeroBackground>
```

### Metric Cards
```typescript
import { MetricCard, ProgressCard } from './components/InsightCards';
<MetricCard title="Revenue" value="$15k" change={{ percent: 27, trend: 'up' }} />
<ProgressCard title="Goal" current={7} target={12} unit="quotes" />
```

### Animated Quote
```typescript
import { AnimatedQuotePreview } from './components/AnimatedQuotePreview';
<AnimatedQuotePreview 
  title="Project Quote"
  clientName="Client"
  quoteItems={items}
  onComplete={() => console.log('Done!')}
/>
```

### Feature Showcase
```typescript
import { WOWShowcase } from './components/WOWShowcase';
<WOWShowcase />
```

## 📁 File Locations

| Feature | File | Type |
|---------|------|------|
| Theme System | `lib/theme.ts` | Core |
| Theme Provider | `components/ThemeProvider.tsx` | Component |
| Theme Switcher | `components/ThemeSwitcher.tsx` | Component |
| Dark-Aware Components | `components/DarkModeAware.tsx` | Component |
| AI Suggestions Engine | `lib/aiSuggestions.ts` | Core |
| Suggestions UI | `components/SuggestionsWidget.tsx` | Component |
| Background Visuals | `components/BackgroundVisuals.tsx` | Component |
| Insight Cards | `components/InsightCards.tsx` | Component |
| Enhanced Dashboard | `components/EnhancedDashboard.tsx` | Component |
| Animated Quote | `components/AnimatedQuotePreview.tsx` | Component |
| WOW Showcase | `components/WOWShowcase.tsx` | Component |

## 🎯 Key Hooks

```typescript
// Theme management
import { useThemeContext } from './components/ThemeProvider';
const { theme, toggleTheme, setMode } = useThemeContext();

// Responsive design
import { useResponsive } from './lib/hooks';
const { isMobile, isTablet, isDesktop } = useResponsive();

// App integration
import { useAppIntegration } from './lib/hooks';
const { trackUserAction, personalization } = useAppIntegration(userId);

// Analytics
import { useAnalytics } from './lib/hooks';
const metrics = useAnalytics(userId);
```

## 🎨 Theme Usage in Components

```typescript
// Access theme in any component
const { theme } = useThemeContext();

// Use theme colors
const styles = {
  background: theme.colors.background,
  text: theme.colors.text,
  primary: theme.colors.primary,
  border: theme.colors.border,
};
```

## 🚀 Common Usage Patterns

### Adding Dark Mode to Existing Component
```typescript
'use client';
import { useThemeContext } from './ThemeProvider';

export const MyComponent = () => {
  const { theme } = useThemeContext();
  
  return (
    <div style={{ backgroundColor: theme.colors.surface }}>
      <p style={{ color: theme.colors.text }}>Content</p>
    </div>
  );
};
```

### Creating a Theme-Aware Card
```typescript
import { DarkModeAwareCard, DarkModeAwareText } from './DarkModeAware';

<DarkModeAwareCard elevated hover>
  <DarkModeAwareText variant="primary">Heading</DarkModeAwareText>
  <DarkModeAwareText variant="secondary">Subtitle</DarkModeAwareText>
</DarkModeAwareCard>
```

### Tracking User Actions for AI Suggestions
```typescript
const { trackUserAction } = useAppIntegration(userId);

// Every action is tracked and used for suggestions
trackUserAction('quote_created', 'quotes', { 
  value: 5000, 
  clientName: 'Acme Corp' 
});
```

## 📊 Available Theme Colors

```typescript
// Light theme
colors: {
  primary: '#667eea',      // Main actions
  secondary: '#764ba2',    // Secondary actions
  success: '#11998e',      // Success states
  warning: '#FFB84D',      // Warnings
  error: '#f5576c',        // Errors
  background: '#f8f9fa',   // Page background
  surface: '#ffffff',      // Cards/surfaces
  text: '#000000',         // Primary text
  textSecondary: '#666666',// Secondary text
  border: '#f0f0f0',       // Borders
}

// Dark theme (same accent colors, different bases)
// background: '#0f0f0f', surface: '#1a1a1a', text: '#ffffff'
```

## 🎯 Quick Configuration

### Change Theme Default Mode
```typescript
// In lib/theme.ts, modify:
export const themeManager = {
  getCurrentTheme(): Theme {
    const stored = localStorage.getItem(STORAGE_KEY);
    const mode = (stored as ThemeMode) || 'auto'; // Change 'auto' here
    return { mode, colors: this.getColorScheme(mode) };
  },
};
```

### Customize Theme Switcher Position
```typescript
import { ThemeSwitcher } from './components/ThemeSwitcher';

// Position options: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
<ThemeSwitcher position="bottom-right" />
```

### Adjust Animation Speeds
```typescript
import { AnimatedQuotePreview } from './components/AnimatedQuotePreview';

// animationDuration is in milliseconds
<AnimatedQuotePreview 
  animationDuration={100} // Default is 50ms, increase for slower
/>
```

## 🔍 Debugging

### Check if Theme is Applied
```typescript
// In browser console:
console.log(document.documentElement.style.getPropertyValue('--color-primary'));
// Should show current theme's primary color
```

### Verify AI Suggestions are Working
```typescript
// In browser console:
console.log(localStorage.getItem('interactions_user-id'));
// Should show user interaction history
```

### Check Component Rendering
```typescript
// Use React DevTools to inspect:
// - ThemeProvider should wrap whole tree
// - useThemeContext should be available in all child components
// - Theme switch should update all components instantly
```

## 📱 Responsive Breakpoints

```typescript
// From lib/hooks.ts
const breakpoints = {
  mobile: 480,    // < 480px
  tablet: 768,    // 480px - 1024px
  desktop: 1200,  // 1024px - 1200px
  large: Infinity,// > 1200px
};

const { isMobile, isTablet, isDesktop } = useResponsive();
```

## 🎬 Animation Timings

```typescript
// Standard animations used:
slideIn: '0.6s ease-out',    // Items sliding in
fadeIn: '0.3-0.8s ease',     // Fading in
pulse: '1.5s infinite',      // Loading state
float: '6-8s continuous',    // Background shapes
hover: '0.3s ease',          // Button hovers
```

## 🚨 Common Issues

### Q: Theme not persisting after refresh
**A:** Check that localStorage is enabled in browser
```typescript
// Verify in console:
localStorage.setItem('test', 'value');
console.log(localStorage.getItem('test')); // Should print "value"
```

### Q: Dark mode not applying to component
**A:** Make sure component is wrapped in ThemeProvider
```typescript
// Wrong:
<MyComponent /> // Won't work, no provider

// Right:
<ThemeProvider>
  <MyComponent />
</ThemeProvider>
```

### Q: Animations are jerky
**A:** Use transform/opacity only (not width/height/position)
```typescript
// Good (hardware accelerated):
transform: 'translateX(20px)'
opacity: 0.5

// Bad (causes reflows):
left: '20px'
display: 'block'
```

## 📚 Documentation Files

- `README.md` - Project overview
- `FEATURES.md` - Complete feature documentation
- `WOW_IMPLEMENTATION_SUMMARY.md` - What was added
- `QUICK_REFERENCE.md` - This file!

## ✅ Checklist for New Features

When adding new components:
- [ ] Import theme context if using colors
- [ ] Use theme.colors for all styling
- [ ] Add responsive styles with useResponsive
- [ ] Test in both light and dark modes
- [ ] Verify animations run smoothly (60fps)
- [ ] Add TypeScript types
- [ ] Document usage examples

## 🎉 You're All Set!

Everything is configured and ready to use. Start your dev server and enjoy your beautiful new app!

```bash
npm run dev
```

Visit: http://localhost:3000

Then click the theme switcher in the top-right corner! 🌙✨
