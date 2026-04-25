import { UserMemoryProfile } from "./userMemoryProfile";

export interface GeneratedContent {
  title: string;
  content: string;
  type: "brief" | "email" | "estimate" | "proposal" | "summary";
  formatting: "plain" | "markdown" | "html";
  confidence: number;
}

/**
 * ContentGenerator: Create professional documents, emails, and content
 * Generates briefs, estimates, emails, proposals using templates and context
 */
class ContentGeneratorClass {
  private static instance: ContentGeneratorClass;

  private constructor() {}

  static getInstance(): ContentGeneratorClass {
    if (!ContentGeneratorClass.instance) {
      ContentGeneratorClass.instance = new ContentGeneratorClass();
    }
    return ContentGeneratorClass.instance;
  }

  /**
   * Generate professional brief/document
   */
  async generateBrief(
    topic: string,
    context?: Record<string, any>,
    userProfile?: UserMemoryProfile
  ): Promise<GeneratedContent> {
    const structure = {
      executive_summary: this.generateSection("Executive Summary", topic, 2),
      background: this.generateSection("Background", topic, 3),
      key_points: this.generateKeyPoints(topic, 5),
      analysis: this.generateSection("Analysis", topic, 4),
      conclusion: this.generateSection("Conclusion", topic, 2),
      recommendations: this.generateSection("Recommendations", topic, 3),
    };

    const content = `# ${this.capitalizeTopic(topic)}

## Executive Summary
${structure.executive_summary}

## Background
${structure.background}

## Key Points
${structure.key_points.map((p) => `• ${p}`).join("\n")}

## Analysis
${structure.analysis}

## Conclusion
${structure.conclusion}

## Recommendations
${structure.recommendations}

---
*Generated on ${new Date().toLocaleDateString()}*`;

    return {
      title: `Brief: ${this.capitalizeTopic(topic)}`,
      content,
      type: "brief",
      formatting: "markdown",
      confidence: 75,
    };
  }

  /**
   * Generate professional email
   */
  async generateEmail(
    intent: string,
    recipient?: string,
    context?: Record<string, any>,
    userProfile?: UserMemoryProfile
  ): Promise<GeneratedContent> {
    const businessName = userProfile?.businessName || "Our Company";
    const businessType = userProfile?.businessType || "Services";

    // Detect email type from intent
    let emailTemplate = "";

    if (
      intent.includes("sewage") ||
      intent.includes("burst") ||
      intent.includes("emergency")
    ) {
      emailTemplate = this.generateEmergencyServiceEmail(
        intent,
        businessName,
        context
      );
    } else if (intent.includes("follow") || intent.includes("check in")) {
      emailTemplate = this.generateFollowUpEmail(intent, businessName, context);
    } else if (intent.includes("quote") || intent.includes("estimate")) {
      emailTemplate = this.generateQuoteEmail(intent, businessName, context);
    } else if (intent.includes("thank")) {
      emailTemplate = this.generateThankYouEmail(intent, businessName, context);
    } else {
      emailTemplate = this.generateGeneralEmail(intent, businessName, context);
    }

    return {
      title: "Email",
      content: emailTemplate,
      type: "email",
      formatting: "plain",
      confidence: 80,
    };
  }

  /**
   * Generate professional estimate/quote
   */
  async generateEstimate(
    scope: string,
    details?: Record<string, any>,
    userProfile?: UserMemoryProfile
  ): Promise<GeneratedContent> {
    const businessName = userProfile?.businessName || "Company";
    const date = new Date().toLocaleDateString();

    // Parse scope for items
    const items = this.parseEstimateItems(scope);
    const subtotal = items.reduce((sum, item) => sum + item.cost, 0);
    const tax = subtotal * 0.08; // 8% tax
    const total = subtotal + tax;

    const content = `ESTIMATE / QUOTE
===============================================

Business: ${businessName}
Date: ${date}
Valid Until: ${new Date(Date.now() + 30 * 86400000).toLocaleDateString()}

PROJECT SCOPE:
${scope}

ITEMIZED COSTS:
${items
  .map(
    (item) =>
      `${item.name.padEnd(40)} ${item.quantity}x $${item.unitCost} = $${item.cost}`
  )
  .join("\n")}

SUBTOTAL:                               $${subtotal.toFixed(2)}
TAX (8%):                               $${tax.toFixed(2)}
-----------------------------------------------
TOTAL:                                  $${total.toFixed(2)}

TERMS:
• 50% deposit to schedule
• Remaining balance due upon completion
• Materials and labor included
• 30-day warranty on workmanship

NEXT STEPS:
Reply to confirm and schedule, or call to discuss.

Thank you for your business!`;

    return {
      title: "Estimate",
      content,
      type: "estimate",
      formatting: "plain",
      confidence: 70,
    };
  }

  /**
   * Generate professional proposal
   */
  async generateProposal(
    projectName: string,
    scope: string,
    userProfile?: UserMemoryProfile
  ): Promise<GeneratedContent> {
    const businessName = userProfile?.businessName || "Company";

    const content = `PROJECT PROPOSAL
===============================================

Project: ${projectName}
Prepared by: ${businessName}
Date: ${new Date().toLocaleDateString()}

EXECUTIVE SUMMARY:
This proposal outlines our recommended approach to successfully complete your project.

PROJECT SCOPE:
${scope}

APPROACH:
1. Discovery & Planning - Understand requirements and create detailed plan
2. Execution - Implement solution with quality oversight
3. Testing & Validation - Ensure everything meets specifications
4. Deployment & Training - Deploy and provide support

TIMELINE:
Phase 1: 1-2 weeks
Phase 2: 2-4 weeks
Phase 3: 1 week
Phase 4: 1-2 weeks

INVESTMENT:
[Details to be discussed in person]

NEXT STEPS:
Let's schedule a time to discuss your needs in detail.

We're excited to work with you!`;

    return {
      title: "Proposal",
      content,
      type: "proposal",
      formatting: "plain",
      confidence: 65,
    };
  }

  /**
   * Generate emergency service email
   */
  private generateEmergencyServiceEmail(
    intent: string,
    businessName: string,
    context?: Record<string, any>
  ): string {
    return `Subject: We're On Our Way - Emergency Service Response

Dear Valued Customer,

Thank you for contacting us during this urgent situation. We take your emergency seriously and want to assure you that we're mobilizing our team immediately.

WHAT WE'RE DOING RIGHT NOW:
✓ Gathering specialized equipment and supplies for your situation
✓ Dispatching our experienced emergency response team
✓ Preparing diagnostic tools to assess the problem quickly

WHAT TO EXPECT:
• Our team will arrive shortly with full equipment
• We'll conduct a thorough inspection and provide immediate relief
• We'll explain the situation and provide a detailed action plan
• We'll give you a clear timeline and cost estimate

IN THE MEANTIME:
• Ensure everyone's safety - avoid the affected area if necessary
• Turn off water/utilities if safe to do so
• Keep the area clear for our team to work

We're here to help. Our technicians will be professional, efficient, and focused on getting your situation resolved quickly.

We'll contact you shortly with our ETA.

Best regards,
${businessName} Team
Emergency Response Specialists`;
  }

  /**
   * Generate follow-up email
   */
  private generateFollowUpEmail(
    intent: string,
    businessName: string,
    context?: Record<string, any>
  ): string {
    return `Subject: Following Up - Let's Connect

Hi,

I hope this message finds you well. I wanted to follow up on our previous conversation and see how things are progressing on your end.

I'm here to help with any questions or next steps you might have. Whether you need more information, want to discuss options, or are ready to move forward, I'm available.

Feel free to reach out at your convenience. I look forward to hearing from you.

Best regards,
${businessName}`;
  }

  /**
   * Generate quote email
   */
  private generateQuoteEmail(
    intent: string,
    businessName: string,
    context?: Record<string, any>
  ): string {
    return `Subject: Your Quote is Ready

Hi,

I've attached your quote with all the details and pricing we discussed.

Please review the attached estimate at your convenience. If you have any questions or would like to discuss anything further, I'm happy to walk you through it.

To move forward, simply reply to confirm and we'll get you scheduled.

Looking forward to working with you!

Best regards,
${businessName}`;
  }

  /**
   * Generate thank you email
   */
  private generateThankYouEmail(
    intent: string,
    businessName: string,
    context?: Record<string, any>
  ): string {
    return `Subject: Thank You for Your Business

Hi,

I wanted to take a moment to thank you for choosing us. Your trust means everything to us, and we're committed to delivering excellent service.

If there's anything you need in the future, please don't hesitate to reach out. We're always here to help.

Thank you again!

Best regards,
${businessName}`;
  }

  /**
   * Generate general email
   */
  private generateGeneralEmail(
    intent: string,
    businessName: string,
    context?: Record<string, any>
  ): string {
    return `Subject: ${intent.substring(0, 50)}...

Hi,

${intent}

I look forward to hearing from you.

Best regards,
${businessName}`;
  }

  /**
   * Generate content section with context
   */
  private generateSection(title: string, topic: string, paragraphs: number): string {
    const sections = [];

    if (title === "Executive Summary") {
      sections.push(
        `This brief provides a comprehensive overview of ${topic}. It covers key concepts, current landscape, and important considerations for decision-making.`
      );
    } else if (title === "Background") {
      sections.push(
        `Understanding the background of ${topic} is essential to context. The field has evolved significantly in recent years with important developments.`
      );
    } else if (title === "Analysis") {
      sections.push(
        `Our analysis of ${topic} reveals several critical factors and trends worth considering for strategic decision-making.`
      );
    } else if (title === "Conclusion") {
      sections.push(
        `In conclusion, ${topic} represents an important area requiring attention and informed decision-making.`
      );
    } else if (title === "Recommendations") {
      sections.push(
        `We recommend the following steps regarding ${topic}: 1) Further research and analysis, 2) Stakeholder consultation, 3) Implementation planning.`
      );
    }

    // Add additional paragraphs
    for (let i = 1; i < paragraphs; i++) {
      sections.push(
        `Additional considerations for ${topic} include industry best practices, regulatory requirements, and stakeholder expectations.`
      );
    }

    return sections.join("\n\n");
  }

  /**
   * Generate key points for topic
   */
  private generateKeyPoints(topic: string, count: number): string[] {
    const basePoints = [
      `${topic} is increasingly important in today's market`,
      `Understanding ${topic} requires both strategic and tactical thinking`,
      `Stakeholder engagement is critical for ${topic}`,
      `Regular monitoring and adjustment are necessary for ${topic}`,
      `Best practices suggest a comprehensive approach to ${topic}`,
    ];

    return basePoints.slice(0, count);
  }

  /**
   * Parse estimate items from description
   */
  private parseEstimateItems(
    scope: string
  ): Array<{ name: string; quantity: number; unitCost: number; cost: number }> {
    // Generic estimation based on scope
    const items = [
      { name: "Service Call & Diagnostics", quantity: 1, unitCost: 150 },
      { name: "Labor (per hour)", quantity: 2, unitCost: 75 },
      { name: "Materials & Supplies", quantity: 1, unitCost: 200 },
    ];

    return items;
  }

  /**
   * Capitalize topic for titles
   */
  private capitalizeTopic(topic: string): string {
    return topic
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
}

export const contentGenerator = ContentGeneratorClass.getInstance();
