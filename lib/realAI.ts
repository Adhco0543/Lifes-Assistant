export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type AIResponse = {
  type?: 'chat' | 'quote' | 'email' | 'task' | string;
  message?: string;
  data?: any;
};

class RealAIService {
  private conversationHistory: AIMessage[] = [];
  private storageKey = 'lifes_assistant_ai_conversations';

  async sendMessage(
    userMessage: string,
    businessContext?: string,
    chatbotName = "Life's Assistant"
  ): Promise<string> {
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          businessContext,
          chatbotName,
          history: this.conversationHistory,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat API error: ${response.status}`);
      }

      const data = (await response.json()) as AIResponse;

      const reply =
        data.message ||
        this.formatActionResponse(data) ||
        "I received your message, but I couldn't generate a response.";

      this.conversationHistory.push({
        role: 'assistant',
        content: reply,
      });

      this.saveConversationHistory();

      return reply;
    } catch (error) {
      console.error('Error getting AI response:', error);

      const fallback =
        "I can help you create quotes, draft emails, manage customers, write notes, create reminders, estimate materials, and organize business tasks.";

      this.conversationHistory.push({
        role: 'assistant',
        content: fallback,
      });

      return fallback;
    }
  }

  private formatActionResponse(data: AIResponse): string {
    if (data.type === 'quote') {
      return 'I started a quote draft for you.';
    }

    if (data.type === 'email') {
      return 'I started an email draft for you.';
    }

    if (data.type === 'task') {
      return 'I created a task draft for you.';
    }

    return '';
  }

  getConversationHistory(): AIMessage[] {
    return [...this.conversationHistory];
  }

  clearConversation(): void {
    this.conversationHistory = [];

    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.warn('Failed to clear conversation:', error);
    }
  }

  loadConversationHistory(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);

      if (stored) {
        this.conversationHistory = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load conversation:', error);
    }
  }

  private saveConversationHistory(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.conversationHistory));
    } catch (error) {
      console.warn('Failed to save conversation:', error);
    }
  }

  updateConfig(): void {
    // Kept for compatibility with existing code.
  }
}

export const realAI = new RealAIService();

export default RealAIService;