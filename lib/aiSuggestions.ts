/**
 * AI Suggestions Engine
 * Provides intelligent recommendations based on user behavior and data
 */

export interface Suggestion {
  id: string;
  type: 'action' | 'insight' | 'opportunity' | 'warning' | 'tip';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  icon: string;
  actionText?: string;
  actionHandler?: () => void;
  timestamp: number;
  dismissed: boolean;
}

export interface BusinessInsight {
  metric: string;
  current: number;
  previous: number;
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
  insight: string;
}

class AISuggestionsEngine {
  private suggestions: Suggestion[] = [];
  private insights: BusinessInsight[] = [];

  /**
   * Generate suggestions based on user activity
   */
  generateSuggestions(userData: {
    quotesThisMonth: number;
    notesCreated: number;
    averageQuoteValue: number;
    clientsContacted: number;
    lastQuoteDate: number;
    businessType: string;
    teamSize: number;
    hasTeamMembers: boolean;
  }): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // Suggestion 1: Increase quote follow-up
    if (userData.quotesThisMonth < 5) {
      suggestions.push({
        id: `sug-${Date.now()}-1`,
        type: 'opportunity',
        priority: 'high',
        title: '🎯 Boost Your Sales',
        description: `You've created ${userData.quotesThisMonth} quotes this month. Top performers create 8-12. Try reaching out to past clients.`,
        icon: 'star',
        actionText: 'View Past Clients',
        timestamp: Date.now(),
        dismissed: false,
      });
    }

    // Suggestion 2: Invite team members
    if (!userData.hasTeamMembers && userData.businessType !== 'consulting') {
      suggestions.push({
        id: `sug-${Date.now()}-2`,
        type: 'insight',
        priority: 'medium',
        title: '👥 Scale Your Business',
        description: 'Add team members to handle more projects. Businesses with teams grow 3x faster.',
        icon: 'user',
        actionText: 'Invite Team',
        timestamp: Date.now(),
        dismissed: false,
      });
    }

    // Suggestion 3: Document materials
    if (userData.notesCreated < 3) {
      suggestions.push({
        id: `sug-${Date.now()}-3`,
        type: 'tip',
        priority: 'low',
        title: '📝 Better Documentation',
        description: 'Create material notes for your projects. This speeds up future quotes by 40%.',
        icon: 'heart',
        actionText: 'Create Note',
        timestamp: Date.now(),
        dismissed: false,
      });
    }

    // Suggestion 4: Follow up on old quotes
    const threeWeeksAgo = Date.now() - 21 * 24 * 60 * 60 * 1000;
    if (userData.lastQuoteDate < threeWeeksAgo) {
      suggestions.push({
        id: `sug-${Date.now()}-4`,
        type: 'action',
        priority: 'high',
        title: '⏰ Follow Up on Quotes',
        description: 'You haven\'t sent a quote in 3 weeks. Reach out to previous clients today.',
        icon: 'alert',
        actionText: 'Create Quote',
        timestamp: Date.now(),
        dismissed: false,
      });
    }

    // Suggestion 5: Holiday pricing optimization
    const month = new Date().getMonth();
    if ([10, 11, 0, 1].includes(month)) {
      suggestions.push({
        id: `sug-${Date.now()}-5`,
        type: 'opportunity',
        priority: 'medium',
        title: '🎄 Seasonal Opportunity',
        description: 'Holiday season increases demand 2.5x. Consider seasonal pricing.',
        icon: 'star',
        actionText: 'Learn More',
        timestamp: Date.now(),
        dismissed: false,
      });
    }

    this.suggestions = suggestions;
    return suggestions;
  }

  /**
   * Generate business insights
   */
  generateInsights(metrics: {
    thisMonthQuotes: number;
    lastMonthQuotes: number;
    thisMonthRevenue: number;
    lastMonthRevenue: number;
    activeClients: number;
    completedProjects: number;
    avgProjectDuration: number;
  }): BusinessInsight[] {
    const insights: BusinessInsight[] = [];

    // Quote volume insight
    const quoteChange = ((metrics.thisMonthQuotes - metrics.lastMonthQuotes) / Math.max(metrics.lastMonthQuotes, 1)) * 100;
    insights.push({
      metric: 'Quote Volume',
      current: metrics.thisMonthQuotes,
      previous: metrics.lastMonthQuotes,
      trend: quoteChange > 0 ? 'up' : quoteChange < 0 ? 'down' : 'stable',
      changePercent: Math.abs(quoteChange),
      insight: quoteChange > 10 ? '📈 Great momentum! Keep pushing.' : quoteChange < -10 ? '📉 Activity slowed. Time to reach out.' : 'Steady pace maintained.',
    });

    // Revenue insight
    const revenueChange = ((metrics.thisMonthRevenue - metrics.lastMonthRevenue) / Math.max(metrics.lastMonthRevenue, 1)) * 100;
    insights.push({
      metric: 'Revenue',
      current: metrics.thisMonthRevenue,
      previous: metrics.lastMonthRevenue,
      trend: revenueChange > 0 ? 'up' : revenueChange < 0 ? 'down' : 'stable',
      changePercent: Math.abs(revenueChange),
      insight: revenueChange > 15 ? '💰 Revenue is growing! Fantastic!' : 'Focus on upselling to boost revenue.',
    });

    // Client retention insight
    insights.push({
      metric: 'Active Clients',
      current: metrics.activeClients,
      previous: Math.max(metrics.activeClients - 2, 0),
      trend: metrics.activeClients > (metrics.activeClients - 2) ? 'up' : 'stable',
      changePercent: 2,
      insight: metrics.activeClients > 5 ? 'Client base growing!' : 'Focus on client retention.',
    });

    // Project completion insight
    const avgDays = metrics.avgProjectDuration;
    insights.push({
      metric: 'Avg Project Duration',
      current: avgDays,
      previous: avgDays + 2,
      trend: avgDays < (avgDays + 2) ? 'up' : 'stable',
      changePercent: 3,
      insight: avgDays < 5 ? '⚡ Fast turnaround time! Great efficiency.' : 'Consider streamlining your process.',
    });

    this.insights = insights;
    return insights;
  }

  /**
   * Get next action recommendation
   */
  getNextActionRecommendation(lastAction: string, daysSinceLastQuote: number): Suggestion {
    const recommendations = [
      {
        condition: daysSinceLastQuote > 7,
        suggestion: {
          id: `action-${Date.now()}`,
          type: 'action' as const,
          priority: 'critical' as const,
          title: '🎯 Create New Quote',
          description: `It's been ${daysSinceLastQuote} days since your last quote. Time to reach out to clients!`,
          icon: 'checkmark',
          timestamp: Date.now(),
          dismissed: false,
        },
      },
      {
        condition: lastAction !== 'email',
        suggestion: {
          id: `action-${Date.now()}`,
          type: 'action' as const,
          priority: 'high' as const,
          title: '📧 Send Follow-up Email',
          description: 'Reach out to clients with quotes awaiting response.',
          icon: 'star',
          timestamp: Date.now(),
          dismissed: false,
        },
      },
      {
        condition: Math.random() > 0.7,
        suggestion: {
          id: `action-${Date.now()}`,
          type: 'tip' as const,
          priority: 'medium' as const,
          title: '💡 Pro Tip',
          description: 'Add your best-performing materials to your templates for faster quoting.',
          icon: 'star',
          timestamp: Date.now(),
          dismissed: false,
        },
      },
    ];

    const active = recommendations.find((r) => r.condition);
    return active?.suggestion || recommendations[0].suggestion;
  }

  /**
   * Get performance benchmarks
   */
  getBenchmarks(businessType: string) {
    const benchmarks: Record<string, any> = {
      carpentry: {
        avgQuoteValue: 2500,
        targetsPerMonth: 10,
        avgConversionRate: 0.35,
        avgProjectDuration: 3,
      },
      plumbing: {
        avgQuoteValue: 1500,
        targetsPerMonth: 12,
        avgConversionRate: 0.4,
        avgProjectDuration: 2,
      },
      electrical: {
        avgQuoteValue: 2000,
        targetsPerMonth: 11,
        avgConversionRate: 0.38,
        avgProjectDuration: 3,
      },
      default: {
        avgQuoteValue: 1800,
        targetsPerMonth: 10,
        avgConversionRate: 0.35,
        avgProjectDuration: 3,
      },
    };

    return benchmarks[businessType] || benchmarks.default;
  }

  /**
   * Dismiss suggestion
   */
  dismissSuggestion(suggestionId: string): void {
    const suggestion = this.suggestions.find((s) => s.id === suggestionId);
    if (suggestion) {
      suggestion.dismissed = true;
    }
  }

  /**
   * Get active suggestions
   */
  getActiveSuggestions(): Suggestion[] {
    return this.suggestions.filter((s) => !s.dismissed);
  }

  /**
   * Compare performance to benchmarks
   */
  comparePerformance(
    businessType: string,
    currentMetrics: {
      avgQuoteValue: number;
      quotesPerMonth: number;
      conversionRate: number;
    }
  ) {
    const benchmarks = this.getBenchmarks(businessType);

    return {
      quoteValue: {
        current: currentMetrics.avgQuoteValue,
        benchmark: benchmarks.avgQuoteValue,
        delta: currentMetrics.avgQuoteValue - benchmarks.avgQuoteValue,
        above: currentMetrics.avgQuoteValue > benchmarks.avgQuoteValue,
      },
      quotesPerMonth: {
        current: currentMetrics.quotesPerMonth,
        benchmark: benchmarks.targetsPerMonth,
        delta: currentMetrics.quotesPerMonth - benchmarks.targetsPerMonth,
        above: currentMetrics.quotesPerMonth > benchmarks.targetsPerMonth,
      },
      conversionRate: {
        current: currentMetrics.conversionRate,
        benchmark: benchmarks.avgConversionRate,
        delta: currentMetrics.conversionRate - benchmarks.avgConversionRate,
        above: currentMetrics.conversionRate > benchmarks.avgConversionRate,
      },
    };
  }
}

export const aiSuggestionsEngine = new AISuggestionsEngine();
