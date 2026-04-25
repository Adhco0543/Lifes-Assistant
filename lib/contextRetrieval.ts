import { Conversation, ConversationMessage } from "./conversationManager";

export interface RelevantContext {
  conversationId: string;
  title: string;
  relevanceScore: number;
  context: string;
  keyTopics: string[];
}

export class ContextRetrieval {
  /**
   * Simple word similarity based on shared words
   * In production, you'd use embeddings from OpenAI or similar
   */
  static calculateSimilarity(text1: string, text2: string): number {
    const normalize = (text: string) =>
      text.toLowerCase().split(/\s+/).filter((w) => w.length > 3);

    const words1 = normalize(text1);
    const words2 = normalize(text2);

    const commonWords = words1.filter((w) => words2.includes(w));
    const totalWords = new Set([...words1, ...words2]).size;

    if (totalWords === 0) return 0;
    return commonWords.length / totalWords;
  }

  /**
   * Extract key topics/entities from text using simple heuristics
   */
  static extractTopics(text: string): string[] {
    const topics: string[] = [];

    // Industry keywords
    const industries = [
      "carpentry",
      "salon",
      "auto repair",
      "restaurant",
      "retail",
      "plumbing",
      "electrical",
      "hvac",
    ];
    industries.forEach((ind) => {
      if (text.toLowerCase().includes(ind)) topics.push(ind);
    });

    // Action keywords
    const actions = ["quote", "invoice", "email", "client", "job", "material", "estimate"];
    actions.forEach((act) => {
      if (text.toLowerCase().includes(act)) topics.push(act);
    });

    // Business terms
    const terms = ["pricing", "scheduling", "follow-up", "lead", "proposal"];
    terms.forEach((term) => {
      if (text.toLowerCase().includes(term)) topics.push(term);
    });

    return [...new Set(topics)]; // Remove duplicates
  }

  /**
   * Find relevant past conversations based on current query
   */
  static findRelevantContext(
    currentQuery: string,
    conversations: Conversation[],
    topK: number = 3
  ): RelevantContext[] {
    const currentTopics = this.extractTopics(currentQuery);

    const scoredConversations = conversations
      .map((conv) => {
        const convText = conv.messages.map((m) => m.content).join(" ");
        const convTopics = conv.messages
          .flatMap((m) => m.metadata?.topics || [])
          .concat(this.extractTopics(convText));

        // Calculate similarity score
        let score = this.calculateSimilarity(currentQuery, convText);

        // Boost score if topics match
        const matchingTopics = currentTopics.filter((t) =>
          convTopics.some((ct) => ct.includes(t) || t.includes(ct))
        );
        score += matchingTopics.length * 0.2;

        // Boost recent conversations
        const daysSinceUpdate = Math.floor(
          (Date.now() - conv.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        const recencyBoost = Math.max(0, 1 - daysSinceUpdate * 0.05);
        score += recencyBoost * 0.15;

        return {
          conversationId: conv.id || "",
          title: conv.title || "Untitled",
          relevanceScore: score,
          context: this.summarizeConversation(conv),
          keyTopics: [...new Set(convTopics)],
        };
      })
      .filter((c) => c.relevanceScore > 0.1)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, topK);

    return scoredConversations;
  }

  /**
   * Summarize a conversation into key points
   */
  static summarizeConversation(conversation: Conversation): string {
    const messages = conversation.messages.slice(-4); // Last 4 messages

    return messages
      .map((msg) => {
        const content = msg.content.substring(0, 150);
        const speaker = msg.role === "user" ? "You" : "Assistant";
        return `${speaker}: ${content}${msg.content.length > 150 ? "..." : ""}`;
      })
      .join("\n");
  }

  /**
   * Create a prompt injection with relevant context
   */
  static buildContextualPrompt(
    userQuery: string,
    relevantContexts: RelevantContext[]
  ): string {
    if (relevantContexts.length === 0) {
      return userQuery;
    }

    let prompt = `Previous relevant conversation(s):\n\n`;

    relevantContexts.forEach((ctx, index) => {
      prompt += `[Conversation ${index + 1}: ${ctx.title} (relevance: ${(ctx.relevanceScore * 100).toFixed(0)}%)]\n`;
      prompt += `${ctx.context}\n\n`;
    });

    prompt += `---\n\nCurrent query:\n${userQuery}`;

    return prompt;
  }

  /**
   * Extract and suggest action items from conversation
   */
  static extractActionItems(messages: ConversationMessage[]): string[] {
    const actions: string[] = [];
    const actionKeywords = [
      "send",
      "create",
      "schedule",
      "follow up",
      "check",
      "generate",
      "prepare",
    ];

    messages.forEach((msg) => {
      if (msg.role === "assistant") {
        actionKeywords.forEach((keyword) => {
          if (msg.content.toLowerCase().includes(keyword)) {
            // Extract the sentence containing the action
            const sentences = msg.content.split(/[.!?]/);
            const relevantSentence = sentences.find((s) =>
              s.toLowerCase().includes(keyword)
            );
            if (relevantSentence) {
              actions.push(relevantSentence.trim());
            }
          }
        });
      }
    });

    return actions;
  }

  /**
   * Get conversation context for greeting
   */
  static getGreetingContext(conversation: Conversation): {
    lastTopic: string;
    pendingItems: string[];
    daysSinceLastChat: number;
  } {
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    const topics = lastMessage?.metadata?.topics || ["general conversation"];
    const pendingItems = lastMessage?.metadata?.actionItems || [];
    const daysSince = Math.floor(
      (Date.now() - conversation.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      lastTopic: topics[0] || "our last conversation",
      pendingItems,
      daysSinceLastChat: daysSince,
    };
  }
}

export default ContextRetrieval;
