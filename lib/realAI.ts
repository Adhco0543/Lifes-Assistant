/**
 * Real AI Integration Service
 * Connects to actual AI APIs (OpenAI, Anthropic, etc.)
 * Handles true conversational AI without rule-based logic
 */

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIServiceConfig {
  apiKey?: string;
  apiProvider?: 'openai' | 'anthropic' | 'mock'; // mock for testing
  model?: string;
  systemPrompt?: string;
}

class RealAIService {
  private config: AIServiceConfig;
  private conversationHistory: AIMessage[] = [];
  private storageKey = 'ai_conversations';

  constructor(config: AIServiceConfig = {}) {
    const provider = config.apiProvider || 'anthropic';
    const isAnthropic = provider === 'anthropic';
    
    this.config = {
      apiProvider: provider,
      model: config.model || (isAnthropic ? 'claude-3-sonnet-20240229' : 'gpt-3.5-turbo'),
      apiKey: config.apiKey || (isAnthropic 
        ? process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY 
        : process.env.NEXT_PUBLIC_OPENAI_API_KEY),
      systemPrompt: config.systemPrompt || this.getDefaultSystemPrompt(),
    };
  }

  /**
   * Default system prompt - tailored for business assistance
   * Works for ANY business type without preset categories
   */
  private getDefaultSystemPrompt(): string {
    return `You are an intelligent business assistant that helps entrepreneurs and business owners with their work.

Your capabilities include:
- Creating and refining business proposals, quotes, and estimates
- Calculating costs, materials, time estimates based on project descriptions
- Project planning and timeline management
- Client communication and professional correspondence
- Business strategy and optimization advice
- Note-taking and information organization
- Problem-solving for business challenges

Key behaviors:
1. Ask clarifying questions when you don't understand the business or project
2. Provide specific, actionable advice tailored to their situation
3. Remember context from earlier in the conversation
4. Adapt your language and expertise to match their industry
5. Be professional yet friendly
6. Always try to understand their underlying business need, not just the surface request
7. Offer multiple approaches when solving problems
8. Ask follow-up questions to provide better solutions

You do NOT:
- Give legal or tax advice (recommend they consult professionals)
- Make promises about business outcomes
- Pretend to have access to real-time data

Example interactions:
- User: "I have a plumbing job tomorrow" → You ask about scope, materials, time, to help with quotes
- User: "Need to email a client" → You draft professional emails tailored to their situation
- User: "How do I calculate this?" → You explain the calculation and help them apply it
- User: "What should I charge?" → You ask about their costs and market rates to give guidance`;
  }

  /**
   * Send message to real AI and get response
   * Maintains conversation history for context
   */
  async sendMessage(userMessage: string, businessContext?: string, chatbotName?: string): Promise<string> {
    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    try {
      let response: string;

      if (this.config.apiProvider === 'mock') {
        // For testing without API key
        response = await this.getMockResponse(userMessage, chatbotName);
      } else if (this.config.apiProvider === 'openai') {
        response = await this.sendToOpenAI(userMessage, businessContext);
      } else if (this.config.apiProvider === 'anthropic') {
        response = await this.sendToAnthropic(userMessage, businessContext);
      } else {
        throw new Error(`Unknown API provider: ${this.config.apiProvider}`);
      }

      // Ensure we have a valid response
      if (!response || typeof response !== 'string' || response.trim() === '') {
        console.warn('Empty response received, using fallback');
        response = `I received your message but had trouble formulating a response. Could you provide more details about what you're trying to accomplish?`;
      }

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: response,
      });

      // Save to localStorage
      this.saveConversationHistory();

      console.log('[RealAI] Response sent:', response.substring(0, 50));
      return response;
    } catch (error) {
      console.error('Error getting AI response:', error);
      const fallbackMsg = `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`;
      
      // Still add the error message to history so user sees something
      this.conversationHistory.push({
        role: 'assistant',
        content: fallbackMsg,
      });
      
      return fallbackMsg;
    }
  }

  /**
   * Send to OpenAI API
   */
  private async sendToOpenAI(userMessage: string, businessContext?: string): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key not configured. Set NEXT_PUBLIC_OPENAI_API_KEY environment variable.');
    }

    const systemPrompt = businessContext
      ? `${this.config.systemPrompt}\n\nBusiness Context: ${businessContext}`
      : this.config.systemPrompt;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          ...this.conversationHistory.slice(-20), // Last 20 messages for context
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * Send to Anthropic Claude API
   */
  private async sendToAnthropic(userMessage: string, businessContext?: string): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('Anthropic API key not configured. Set NEXT_PUBLIC_ANTHROPIC_API_KEY environment variable.');
    }

    const systemPrompt = businessContext
      ? `${this.config.systemPrompt}\n\nBusiness Context: ${businessContext}`
      : this.config.systemPrompt;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model || 'claude-3-sonnet-20240229',
        max_tokens: 1500,
        system: systemPrompt,
        messages: this.conversationHistory.slice(-20), // Last 20 messages for context
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  /**
   * Mock response for testing (no API key needed)
   */
  private async getMockResponse(userMessage: string, chatbotName: string = 'AI Assistant'): Promise<string> {
    // Simulate thinking time
    await new Promise((resolve) => setTimeout(resolve, 300));

    const lowerMsg = userMessage.toLowerCase().trim();
    const botNameLower = chatbotName.toLowerCase().trim();

    if (!lowerMsg) {
      return `I didn't catch that. Could you please say something?`;
    }

    // Check for name-based greetings (e.g., "hey Alex" or "hey there Alex")
    if (lowerMsg.includes(`hey ${botNameLower}`) || lowerMsg.includes(`hi ${botNameLower}`) || lowerMsg.includes(`hello ${botNameLower}`)) {
      const greetings = [
        `Hey there! It's me, ${chatbotName}! 👋 What can I help you with today?`,
        `Hey! I'm ${chatbotName}, your business assistant. What's up? 💼`,
        `${chatbotName} here! Ready to help you crush your business goals. What do you need? 🚀`,
        `That's me! I'm ${chatbotName}. How can I make your day easier?`,
        `Yep, it's ${chatbotName}! What can I do for you right now?`,
        `${chatbotName} at your service! 💡 What's on your mind?`,
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    }

    // Smart mock responses based on message content
    if (lowerMsg.includes('quote') || lowerMsg.includes('bid')) {
      return `Great! I can help you create a professional quote. To give you the most accurate estimate, could you tell me:

1. **Project scope** - What exactly are they asking you to do?
2. **Materials** - Will you need to supply any materials, or are they providing them?
3. **Timeline** - How many days/hours do you think this will take?
4. **Your rates** - What do you normally charge per hour or per project?

Once I have these details, I can help you put together a professional bid that protects your business while staying competitive.`;
    } else if (lowerMsg.includes('estimate') || lowerMsg.includes('calculate')) {
      return `I'd be happy to help you calculate that! To give you an accurate estimate, I'll need:

- **Dimensions or quantities** - Give me measurements or the amount of work
- **Breakdown** - What are the main components or phases?
- **Your costs** - What does it cost you (materials, labor, overhead)?

With this information, I can calculate:
- Total project cost
- Markup for profit
- Your final quote price
- Alternative pricing options`;
    } else if (lowerMsg.includes('help') || lowerMsg.includes('what can')) {
      return `I'm here to help you run your business more effectively! Here's what I can assist with:

📋 **Quotes & Estimates** - Create professional bids and proposals
📊 **Calculations** - Figure out costs, time, and pricing
📁 **Project Planning** - Organize projects, set timelines, track progress
📧 **Communication** - Draft professional emails and client messages
💡 **Strategy** - Brainstorm solutions and business improvements
📝 **Notes & Ideas** - Keep track of important information
🎯 **Problem Solving** - Work through business challenges together

Just tell me what you're working on, and I'll help you figure it out!`;
    } else if (lowerMsg.includes('speak') || lowerMsg.includes('talk') || lowerMsg.includes('chat') || lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
      return `Absolutely! I'd love to chat with you about your business. What's on your mind today? 

Whether it's:
- A project you're working on
- Something you need to figure out
- A challenge you're facing
- Ideas you want to brainstorm

I'm here to help. What would you like to talk about?`;
    } else {
      return `That's interesting! I'm here to help you with your business. To give you the best assistance, could you tell me a bit more about:

- What industry or type of work are you in?
- What specifically are you trying to accomplish with this?
- Any constraints I should know about (budget, timeline, etc.)?

Once I understand your situation better, I can give you practical advice and solutions tailored to your business.`;
    }
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): AIMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Clear conversation
   */
  clearConversation(): void {
    this.conversationHistory = [];
    try {
      localStorage.removeItem(this.storageKey);
    } catch (e) {
      console.warn('Failed to clear conversation:', e);
    }
  }

  /**
   * Save conversation to localStorage
   */
  private saveConversationHistory(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.conversationHistory));
    } catch (e) {
      console.warn('Failed to save conversation:', e);
    }
  }

  /**
   * Load conversation from localStorage
   */
  loadConversationHistory(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.conversationHistory = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load conversation:', e);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AIServiceConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Singleton instance
export const realAI = new RealAIService({
  apiProvider: process.env.NEXT_PUBLIC_AI_PROVIDER === 'openai' ? 'openai' : 'anthropic',
});

export default RealAIService;
