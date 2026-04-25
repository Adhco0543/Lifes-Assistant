/**
 * Business Intelligence Engine
 * Analyzes conversations and provides smart insights
 * Powers recommendations, pattern detection, and analytics
 */

import type { ChatMessage, Conversation } from './firebaseBackend';

export interface BusinessInsight {
  type: 'opportunity' | 'pattern' | 'recommendation' | 'warning' | 'achievement';
  title: string;
  description: string;
  actionable: boolean;
  action?: string; // What to do about it
  confidence: number; // 0-1
  relatedConversations?: string[];
}

export interface BusinessMetrics {
  totalMessages: number;
  totalConversations: number;
  averageResponseTime: number;
  busyHours: Record<string, number>;
  topicFrequency: Record<string, number>;
  quotesCreated: number;
  projectsTracked: number;
  estimatedBusinessValue: number;
}

export interface UserBehavior {
  mostActiveTime: string; // Time of day
  averageSessionLength: number;
  responseStyle: 'brief' | 'detailed' | 'mixed';
  preferredTopics: string[];
  engagementLevel: 'high' | 'medium' | 'low';
  growthTrend: 'increasing' | 'stable' | 'declining';
}

/**
 * Advanced analytics and intelligence engine
 */
export class IntelligenceEngine {
  /**
   * Analyze all conversations to extract business insights
   */
  analyzeConversations(messages: ChatMessage[], conversations: Conversation[]): BusinessInsight[] {
    const insights: BusinessInsight[] = [];

    // Analyze message patterns
    insights.push(...this.detectPatterns(messages));

    // Analyze user behavior
    insights.push(...this.analyzeBehavior(messages));

    // Generate recommendations
    insights.push(...this.generateRecommendations(messages, conversations));

    // Sort by confidence and actionability
    return insights.sort((a, b) => {
      if (a.actionable !== b.actionable) return a.actionable ? -1 : 1;
      return b.confidence - a.confidence;
    });
  }

  /**
   * Detect patterns in conversation topics
   */
  private detectPatterns(messages: ChatMessage[]): BusinessInsight[] {
    const insights: BusinessInsight[] = [];
    const userMessages = messages.filter((m) => m.role === 'user');

    // Extract keywords/topics
    const topicFrequency: Record<string, number> = {};
    const keywords = [
      'quote',
      'bid',
      'estimate',
      'materials',
      'cost',
      'time',
      'project',
      'client',
      'email',
      'measurement',
      'calculate',
      'help',
    ];

    userMessages.forEach((msg) => {
      const content = msg.content.toLowerCase();
      keywords.forEach((kw) => {
        if (content.includes(kw)) {
          topicFrequency[kw] = (topicFrequency[kw] || 0) + 1;
        }
      });
    });

    // Find dominant topics
    const dominantTopic = Object.entries(topicFrequency).sort(([, a], [, b]) => b - a)[0];

    if (dominantTopic) {
      const [topic, count] = dominantTopic;
      const percentage = (count / userMessages.length) * 100;

      if (percentage > 40) {
        insights.push({
          type: 'pattern',
          title: `Primary Focus: ${this.capitalize(topic)}`,
          description: `${Math.round(percentage)}% of your questions are about ${topic}. This is your main area of focus.`,
          actionable: true,
          action: `Create templates for ${topic}-related tasks to save time`,
          confidence: 0.9,
        });
      }
    }

    // Detect time-based patterns
    const hourFrequency = this.analyzeTimingPattern(messages);
    const busyHour = Object.entries(hourFrequency).sort(([, a], [, b]) => b - a)[0];

    if (busyHour) {
      const [hour, count] = busyHour;
      insights.push({
        type: 'pattern',
        title: `Peak Activity: ${hour}:00`,
        description: `You're most active around ${hour}:00. Plan important tasks for this time.`,
        actionable: false,
        confidence: 0.8,
      });
    }

    return insights;
  }

  /**
   * Analyze user behavior
   */
  private analyzeBehavior(messages: ChatMessage[]): BusinessInsight[] {
    const insights: BusinessInsight[] = [];
    const userMessages = messages.filter((m) => m.role === 'user');

    if (userMessages.length === 0) return insights;

    // Calculate average message length
    const avgLength = userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length;

    let responseStyle: 'brief' | 'detailed' | 'mixed' = 'mixed';
    if (avgLength < 100) {
      responseStyle = 'brief';
    } else if (avgLength > 300) {
      responseStyle = 'detailed';
    }

    // Engagement analysis
    const daysSinceLastMessage = Math.floor(
      (Date.now() - messages[messages.length - 1]?.timestamp * 1000) / (1000 * 60 * 60 * 24)
    );

    let engagementLevel: 'high' | 'medium' | 'low' = 'medium';
    if (daysSinceLastMessage < 1) {
      engagementLevel = 'high';
    } else if (daysSinceLastMessage > 7) {
      engagementLevel = 'low';
    }

    if (engagementLevel === 'low' && daysSinceLastMessage > 7) {
      insights.push({
        type: 'warning',
        title: 'Low Recent Activity',
        description: `Haven't used the assistant in ${daysSinceLastMessage} days. Get back to staying productive!`,
        actionable: true,
        action: 'Open chat and discuss your current project',
        confidence: 0.85,
      });
    }

    return insights;
  }

  /**
   * Generate smart recommendations
   */
  private generateRecommendations(messages: ChatMessage[], conversations: Conversation[]): BusinessInsight[] {
    const insights: BusinessInsight[] = [];
    const userMessages = messages.filter((m) => m.role === 'user');

    // Recommendation: Use templates
    const quoteMentions = userMessages.filter((m) => m.content.toLowerCase().includes('quote')).length;
    if (quoteMentions > 3) {
      insights.push({
        type: 'recommendation',
        title: 'Create Quote Templates',
        description: `You've asked about quotes ${quoteMentions} times. Creating templates could save you time.`,
        actionable: true,
        action: 'Build quote templates for your most common project types',
        confidence: 0.9,
      });
    }

    // Recommendation: Organization
    if (conversations.length > 10) {
      const untaggedConversations = conversations.filter((c) => !c.tags || c.tags.length === 0).length;
      if (untaggedConversations > 5) {
        insights.push({
          type: 'recommendation',
          title: 'Organize Your Conversations',
          description: `${untaggedConversations} conversations are untagged. Tagging helps you find things faster.`,
          actionable: true,
          action: 'Add tags to your conversations (e.g., "urgent", "client-name", "project-type")',
          confidence: 0.75,
        });
      }
    }

    // Recommendation: Search usage
    const hasSearchedBefore = messages.some((m) => m.content.toLowerCase().includes('find') || m.content.toLowerCase().includes('search'));
    if (!hasSearchedBefore && messages.length > 20) {
      insights.push({
        type: 'recommendation',
        title: 'Use Search to Find Old Conversations',
        description: `You have many conversations. Use search to quickly find old information.`,
        actionable: true,
        action: 'Try searching for keywords from your past conversations',
        confidence: 0.7,
      });
    }

    // Achievement: Milestone
    if (messages.length >= 100) {
      insights.push({
        type: 'achievement',
        title: '🎉 100 Messages Milestone!',
        description: `You've had over 100 messages with your AI assistant. That's great engagement!`,
        actionable: false,
        confidence: 1,
      });
    }

    return insights;
  }

  /**
   * Calculate business metrics
   */
  calculateMetrics(messages: ChatMessage[], conversations: Conversation[]): BusinessMetrics {
    const userMessages = messages.filter((m) => m.role === 'user');

    return {
      totalMessages: messages.length,
      totalConversations: conversations.length,
      averageResponseTime: this.calculateAverageResponseTime(messages),
      busyHours: this.analyzeTimingPattern(messages),
      topicFrequency: this.analyzeTopicFrequency(userMessages),
      quotesCreated: this.countKeywordMentions(userMessages, ['quote', 'bid', 'estimate']),
      projectsTracked: this.countKeywordMentions(userMessages, ['project', 'timeline', 'milestone']),
      estimatedBusinessValue: this.estimateBusinessValue(messages),
    };
  }

  /**
   * Analyze user behavior patterns
   */
  analyzeBehaviorPattern(messages: ChatMessage[]): UserBehavior {
    const userMessages = messages.filter((m) => m.role === 'user');

    // Most active time
    const hourFrequency = this.analyzeTimingPattern(messages);
    const mostActiveTime = Object.entries(hourFrequency).sort(([, a], [, b]) => b - a)[0]?.[0] || '9:00';

    // Average session length (assume 5 min between messages is new session)
    const sessionLengths: number[] = [];
    let sessionMessages = 0;

    for (let i = 0; i < messages.length; i++) {
      const timeSinceLast = i > 0 ? (messages[i].timestamp - messages[i - 1].timestamp) / 1000 : 0;

      if (timeSinceLast > 300) {
        if (sessionMessages > 0) sessionLengths.push(sessionMessages);
        sessionMessages = 1;
      } else {
        sessionMessages++;
      }
    }

    const averageSessionLength = sessionLengths.length > 0 ? sessionLengths.reduce((a, b) => a + b) / sessionLengths.length : 0;

    // Response style
    const avgLength = userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length;
    let responseStyle: 'brief' | 'detailed' | 'mixed' = 'mixed';
    if (avgLength < 100) responseStyle = 'brief';
    else if (avgLength > 300) responseStyle = 'detailed';

    // Engagement level
    const daysSinceLastMessage = Math.floor((Date.now() - (messages[messages.length - 1]?.timestamp * 1000 || Date.now())) / (1000 * 60 * 60 * 24));
    let engagementLevel: 'high' | 'medium' | 'low' = 'medium';
    if (daysSinceLastMessage < 1) engagementLevel = 'high';
    else if (daysSinceLastMessage > 7) engagementLevel = 'low';

    // Growth trend
    const firstHalf = userMessages.slice(0, Math.floor(userMessages.length / 2)).length;
    const secondHalf = userMessages.slice(Math.floor(userMessages.length / 2)).length;
    let growthTrend: 'increasing' | 'stable' | 'declining' = 'stable';
    if (secondHalf > firstHalf * 1.2) growthTrend = 'increasing';
    else if (secondHalf < firstHalf * 0.8) growthTrend = 'declining';

    return {
      mostActiveTime,
      averageSessionLength,
      responseStyle,
      preferredTopics: this.extractTopTopics(userMessages),
      engagementLevel,
      growthTrend,
    };
  }

  /**
   * Helper methods
   */
  private analyzeTimingPattern(messages: ChatMessage[]): Record<string, number> {
    const hourFrequency: Record<string, number> = {};

    messages.forEach((msg) => {
      const date = new Date(msg.timestamp * 1000);
      const hour = date.getHours().toString().padStart(2, '0');
      hourFrequency[hour] = (hourFrequency[hour] || 0) + 1;
    });

    return hourFrequency;
  }

  private analyzeTopicFrequency(messages: ChatMessage[]): Record<string, number> {
    const topicFrequency: Record<string, number> = {};
    const keywords = [
      'quote',
      'bid',
      'estimate',
      'materials',
      'cost',
      'time',
      'project',
      'client',
      'email',
      'measurement',
      'calculate',
    ];

    messages.forEach((msg) => {
      const content = msg.content.toLowerCase();
      keywords.forEach((kw) => {
        if (content.includes(kw)) {
          topicFrequency[kw] = (topicFrequency[kw] || 0) + 1;
        }
      });
    });

    return topicFrequency;
  }

  private calculateAverageResponseTime(messages: ChatMessage[]): number {
    const userMessages = messages.filter((m) => m.role === 'user');
    const responseTimes: number[] = [];

    for (let i = 0; i < userMessages.length - 1; i++) {
      const nextAssistantMsg = messages.find(
        (m) => m.role === 'assistant' && m.timestamp > userMessages[i].timestamp
      );

      if (nextAssistantMsg) {
        responseTimes.push(nextAssistantMsg.timestamp - userMessages[i].timestamp);
      }
    }

    return responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b) / responseTimes.length : 0;
  }

  private countKeywordMentions(messages: ChatMessage[], keywords: string[]): number {
    return messages.filter((msg) =>
      keywords.some((kw) => msg.content.toLowerCase().includes(kw))
    ).length;
  }

  private extractTopTopics(messages: ChatMessage[], limit: number = 5): string[] {
    const topicFreq = this.analyzeTopicFrequency(messages);
    return Object.entries(topicFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([topic]) => topic);
  }

  private estimateBusinessValue(messages: ChatMessage[]): number {
    // Rough estimate: avg quote value × estimated quotes created
    const quoteMentions = messages.filter((m) =>
      m.content.toLowerCase().includes('quote') || m.content.toLowerCase().includes('bid')
    ).length;

    // Rough assumption: $500 average project value
    return quoteMentions * 500;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Export singleton
export const intelligenceEngine = new IntelligenceEngine();

export default IntelligenceEngine;
