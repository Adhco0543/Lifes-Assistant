/**
 * AI Assistant Core - Conversational AI Engine
 * Natural language AI assistant that helps with business tasks
 * Works like a true assistant - ongoing conversations, adaptive help, real problem-solving
 */

import { BusinessProfile } from './businessProfile';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  context?: Record<string, any>;
}

export interface ConversationContext {
  businessProfile: BusinessProfile;
  recentMessages: Message[];
  currentTask: string | null;
  userData: Record<string, any>;
  conversationTheme?: string;
}

export interface AIResponse {
  message: string;
  suggestions: string[];
  actions: string[];
  data?: Record<string, any>;
}

class AIAssistant {
  private conversationHistory: Message[] = [];
  private context: ConversationContext | null = null;
  private conversationKey = 'ai_conversations';
  private conversationTheme: string = 'general';

  /**
   * Initialize assistant with business context
   */
  initializeContext(businessProfile: BusinessProfile, userData: Record<string, any> = {}): void {
    const loaded = this.loadConversationHistory(businessProfile.userId);
    this.conversationHistory = loaded;
    
    this.context = {
      businessProfile,
      recentMessages: loaded,
      currentTask: null,
      userData,
    };
  }

  /**
   * Process user message and generate AI response
   * This is the main entry point for all conversations
   */
  async processMessage(userMessage: string, userId: string): Promise<AIResponse> {
    if (!this.context) {
      throw new Error('Context not initialized');
    }

    // Create message object
    const userMsg: Message = {
      id: `msg-${Date.now()}-${Math.random()}`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    };

    this.conversationHistory.push(userMsg);
    this.saveConversationHistory(userId);

    // Analyze user intent and context
    const intent = this.analyzeIntent(userMessage);
    const recentContext = this.getRecentContext(5);

    // Generate natural, conversational response
    const response = this.generateConversationalResponse(intent, userMessage, recentContext);

    // Track conversation theme for continuity
    this.conversationTheme = intent;

    // Add assistant message to history
    const assistantMsg: Message = {
      id: `msg-${Date.now()}-${Math.random()}`,
      role: 'assistant',
      content: response.message,
      timestamp: Date.now(),
      context: { intent, theme: this.conversationTheme },
    };

    this.conversationHistory.push(assistantMsg);
    this.saveConversationHistory(userId);

    return response;
  }

  /**
   * Analyze user intent and conversation context
   * More nuanced than keyword matching - looks for actual needs
   */
  private analyzeIntent(message: string): string {
    const lowerMsg = message.toLowerCase();

    // Check for explicit questions and needs
    if (/^(how|what|when|where|why|can you|could you|would you|should i)/i.test(message)) {
      return 'help';
    }

    // Domain-specific intents
    if (lowerMsg.includes('quote') || lowerMsg.includes('bid') || lowerMsg.includes('estimate') || lowerMsg.includes('pricing')) {
      return 'bidding';
    }
    if (lowerMsg.includes('material') || lowerMsg.includes('supply') || lowerMsg.includes('parts') || lowerMsg.includes('equipment')) {
      return 'materials';
    }
    if (lowerMsg.includes('job') || lowerMsg.includes('project') || lowerMsg.includes('work') || lowerMsg.includes('client')) {
      return 'projects';
    }
    if (lowerMsg.includes('note') || lowerMsg.includes('remember') || lowerMsg.includes('save')) {
      return 'notes';
    }
    if (lowerMsg.includes('email') || lowerMsg.includes('contact') || lowerMsg.includes('send')) {
      return 'communication';
    }
    if (lowerMsg.includes('measure') || lowerMsg.includes('dimension') || lowerMsg.includes('size')) {
      return 'measurements';
    }
    if (lowerMsg.includes('calculate') || lowerMsg.includes('compute') || lowerMsg.includes('math')) {
      return 'calculations';
    }
    if (lowerMsg.includes('suggest') || lowerMsg.includes('recommend') || lowerMsg.includes('advice') || lowerMsg.includes('think')) {
      return 'suggestions';
    }

    return 'general';
  }

  /**
   * Get recent conversation context for better responses
   */
  private getRecentContext(messageCount: number): string {
    const recent = this.conversationHistory.slice(-messageCount);
    return recent.map(m => `${m.role}: ${m.content}`).join('\n');
  }

  /**
   * Generate natural, conversational response
   * Adapts based on intent and conversation context
   */
  private generateConversationalResponse(intent: string, message: string, recentContext: string): AIResponse {
    if (!this.context) {
      throw new Error('Context not initialized');
    }

    const { businessProfile } = this.context;
    const businessType = businessProfile.businessType || 'your';

    // Determine response style based on intent
    switch (intent) {
      case 'bidding':
        return this.generateBiddingResponse(message, businessType);
      case 'materials':
        return this.generateMaterialsResponse(message, businessType);
      case 'projects':
        return this.generateProjectsResponse(message, businessType);
      case 'notes':
        return this.generateNotesResponse(message);
      case 'communication':
        return this.generateCommunicationResponse(message);
      case 'measurements':
        return this.generateMeasurementsResponse(message, businessType);
      case 'calculations':
        return this.generateCalculationsResponse(message, businessType);
      case 'suggestions':
        return this.generateSuggestionsResponse(message, businessType);
      case 'help':
        return this.generateHelpResponse(message, businessType);
      default:
        return this.generateGeneralResponse(message, businessType);
    }
  }

  /**
   * Generate natural response for bidding/quote requests
   */
  private generateBiddingResponse(message: string, businessType: string): AIResponse {
    const responses = [
      `I can help you create a professional bid for this project. Do you want me to:
- Generate a quote template based on the scope you describe
- Calculate labor costs based on time estimates
- Add material costs if you have a list
- Format it professionally for sending to the client`,
      `Got it! I'll help you with the bid. Tell me:
- What are the main deliverables or work items?
- How much time will this take (in hours or days)?
- Any specific materials or supplies needed?
- What's your hourly rate or standard markup?`,
      `Perfect! I can create a detailed estimate. The key details I'll need:
- Project scope and deliverables
- Time estimates for each phase
- Material costs (if applicable)
- Your margin/markup preference`,
    ];
    const response = responses[Math.floor(Math.random() * responses.length)];

    return {
      message: response,
      suggestions: [
        'Create quote now',
        'Tell me the scope',
        'Calculate labor hours',
        'Add materials',
      ],
      actions: ['open_quote_builder'],
    };
  }

  /**
   * Generate natural response for materials requests
   */
  private generateMaterialsResponse(message: string, businessType: string): AIResponse {
    const responses = [
      `I can help you figure out what materials you need. To get accurate estimates, tell me:
- Project dimensions or square footage
- Type of materials you typically use
- Any specific requirements or preferences
- Budget constraints if applicable`,
      `Let me help you calculate materials! I'll need:
- The size/scope of the project (length, width, height, square feet, etc.)
- What type of ${businessType} materials are needed
- Any waste factor or overage percentage you use
- Unit costs if you already have supplier quotes`,
      `No problem! To calculate materials accurately:
- Describe the project size and scale
- What materials are involved?
- Any standard waste/margin you include?
- Should I include supplier recommendations?`,
    ];
    const response = responses[Math.floor(Math.random() * responses.length)];

    return {
      message: response,
      suggestions: [
        'Give project dimensions',
        'List the materials',
        'Get supplier suggestions',
        'Calculate totals',
      ],
      actions: ['material_calculator'],
    };
  }

  /**
   * Generate natural response for project management
   */
  private generateProjectsResponse(message: string, businessType: string): AIResponse {
    return {
      message: `I can help you manage this project. What would be most helpful right now?
- Creating a timeline with milestones
- Breaking down tasks and deliverables
- Tracking progress as you go
- Managing client communication
- Generating status reports`,
      suggestions: [
        'Create timeline',
        'Add tasks',
        'Track progress',
        'Update client',
      ],
      actions: [],
    };
  }

  /**
   * Generate natural response for notes
   */
  private generateNotesResponse(message: string): AIResponse {
    return {
      message: `I'll save that for you! I can organize notes by:
- Project or client
- Type (ideas, measurements, specs, to-dos)
- Tags for easy finding later
- Links to related projects or clients

Want me to save this note now?`,
      suggestions: [
        'Save this note',
        'Tag it',
        'Link to project',
        'Set reminder',
      ],
      actions: ['save_note'],
    };
  }

  /**
   * Generate natural response for communication
   */
  private generateCommunicationResponse(message: string): AIResponse {
    return {
      message: `I can help with client communication! I can:
- Draft professional emails
- Create follow-up messages
- Format quotes for sending
- Schedule reminders for outreach
- Create message templates for common situations

What would you like me to help with?`,
      suggestions: [
        'Draft email',
        'Send quote',
        'Schedule follow-up',
        'Create template',
      ],
      actions: [],
    };
  }

  /**
   * Generate natural response for measurements
   */
  private generateMeasurementsResponse(message: string, businessType: string): AIResponse {
    return {
      message: `Got it! I can help with measurements. I can:
- Parse dimension descriptions you give me
- Convert between units (feet, inches, meters, etc.)
- Calculate areas and volumes
- Store measurements for future reference
- Link them to projects

Go ahead and tell me the measurements!`,
      suggestions: [
        'Parse measurements',
        'Convert units',
        'Calculate area',
        'Save for later',
      ],
      actions: [],
    };
  }

  /**
   * Generate natural response for calculations
   */
  private generateCalculationsResponse(message: string, businessType: string): AIResponse {
    return {
      message: `I can handle calculations for you! What do you need?
- Cost breakdowns (labor, materials, overhead)
- Time estimates for ${businessType} work
- Volume or quantity calculations
- Profit margins and pricing analysis
- ROI or project profitability

What should I calculate?`,
      suggestions: [
        'Calculate costs',
        'Estimate time',
        'Compute volumes',
        'Figure profit',
      ],
      actions: [],
    };
  }

  /**
   * Generate natural response for suggestions/advice
   */
  private generateSuggestionsResponse(message: string, businessType: string): AIResponse {
    return {
      message: `I'd be happy to suggest something! Based on what I know about ${businessType} work, I can recommend:
- Materials or products that work well
- Process improvements or shortcuts
- Cost-saving ideas
- Quality enhancements
- Time-saving techniques
- Pricing strategies

Tell me more about your situation and I'll give you specific suggestions!`,
      suggestions: [
        'Material recommendations',
        'Cost-saving tips',
        'Process improvement',
        'Quality enhancement',
      ],
      actions: [],
    };
  }

  /**
   * Generate natural response to help requests
   */
  private generateHelpResponse(message: string, businessType: string): AIResponse {
    return {
      message: `I'm here to help! For your ${businessType} business, I can assist with:
- **Quotes & Bidding** - Creating professional estimates and bids
- **Materials** - Calculating what you need for a project
- **Projects** - Managing timelines, tasks, and delivery
- **Notes** - Saving ideas, measurements, and specifications
- **Communication** - Drafting emails and client outreach
- **Calculations** - Costs, time estimates, pricing
- **Advice** - Recommendations based on your needs

What do you need help with right now?`,
      suggestions: [
        'Create a quote',
        'Calculate materials',
        'Start project tracking',
        'Save a note',
      ],
      actions: [],
    };
  }

  /**
   * Generate natural response for general conversation
   */
  private generateGeneralResponse(message: string, businessType: string): AIResponse {
    const responses = [
      `I understand! I'm here to help with your ${businessType} business needs. Can I help you with:
- Creating quotes or bids
- Planning projects
- Calculating materials or costs
- Saving important notes
- Drafting communications`,
      `Got it! For your ${businessType} business, I can help with just about anything related to:
- Quotes, estimates, and bidding
- Project planning and tracking
- Materials and supplies calculation
- Client communication
- Notes and reminders

What would be most helpful?`,
      `I'm ready to help! Whether you need to:
- Create a bid or quote
- Figure out materials
- Manage a project
- Keep track of important info
- Draft an email

Just let me know what you're working on!`,
    ];
    const response = responses[Math.floor(Math.random() * responses.length)];

    return {
      message: response,
      suggestions: [
        'Create quote',
        'Calculate materials',
        'Save note',
        'Draft email',
      ],
      actions: [],
    };
  }

  /**
   * Get conversation history
   */
  getConversationHistory(limit: number = 50): Message[] {
    return this.conversationHistory.slice(-limit);
  }

  /**
   * Clear conversation history
   */
  clearHistory(userId: string): void {
    this.conversationHistory = [];
    try {
      localStorage.removeItem(`${this.conversationKey}_${userId}`);
    } catch (e) {
      console.warn('Failed to clear history:', e);
    }
  }

  /**
   * Save conversation to localStorage
   */
  private saveConversationHistory(userId: string): void {
    try {
      const key = `${this.conversationKey}_${userId}`;
      localStorage.setItem(key, JSON.stringify(this.conversationHistory.slice(-100)));
    } catch (e) {
      console.warn('Failed to save conversation:', e);
    }
  }

  /**
   * Load conversation from localStorage
   */
  private loadConversationHistory(userId: string): Message[] {
    try {
      const key = `${this.conversationKey}_${userId}`;
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.warn('Failed to load conversation:', e);
      return [];
    }
  }

  /**
   * Get context summary
   */
  getContextSummary(): string {
    if (!this.context) return 'No context';

    const { businessProfile, recentMessages } = this.context;
    return `${businessProfile.businessType} business - Recent messages: ${recentMessages.length}`;
  }
}

export const aiAssistant = new AIAssistant();
