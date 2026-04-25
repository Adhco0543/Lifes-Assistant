/**
 * Quote and Bid System
 * Generates professional quotes and bid management
 */

import { BusinessProfile } from './businessProfile';

export interface Quote {
  id: string;
  clientId: string;
  clientName: string;
  businessName: string;
  createdAt: number;
  quoteDate: string;
  validUntil: string;
  items: QuoteLineItem[];
  subtotal: number;
  taxRate: number;
  tax: number;
  total: number;
  notes: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
}

export interface QuoteLineItem {
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export interface BidMetadata {
  businessType: string;
  scope: string;
  measurements?: Record<string, number>;
  materials?: string[];
  estimatedHours?: number;
}

class QuotingSystem {
  private quotes: Quote[] = [];
  private storageKey = 'quotes';
  private materialPrices: Record<string, Record<string, number>> = {};

  /**
   * Create new quote from scope and business profile
   */
  createQuote(
    clientName: string,
    businessProfile: BusinessProfile,
    scope: string,
    metadata: BidMetadata
  ): Quote {
    const quote: Quote = {
      id: `quote-${Date.now()}-${Math.random()}`,
      clientId: `client-${Date.now()}`,
      clientName,
      businessName: businessProfile.businessName,
      createdAt: Date.now(),
      quoteDate: new Date().toLocaleDateString(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      items: this.generateLineItems(scope, businessProfile, metadata),
      subtotal: 0,
      taxRate: 0.1,
      tax: 0,
      total: 0,
      notes: `Quote for ${scope}`,
      status: 'draft',
    };

    // Calculate totals
    quote.subtotal = quote.items.reduce((sum, item) => sum + item.amount, 0);
    quote.tax = quote.subtotal * quote.taxRate;
    quote.total = quote.subtotal + quote.tax;

    this.quotes.push(quote);
    this.saveQuotes();

    return quote;
  }

  /**
   * Generate line items based on business type and scope
   */
  private generateLineItems(
    scope: string,
    businessProfile: BusinessProfile,
    metadata: BidMetadata
  ): QuoteLineItem[] {
    const items: QuoteLineItem[] = [];
    const businessType = businessProfile.businessType;

    // Labor item
    if (metadata.estimatedHours) {
      const rate = businessProfile.settings.defaultHourlyRate || 50;
      items.push({
        description: `Labor - ${scope}`,
        quantity: metadata.estimatedHours,
        unit: 'hours',
        rate,
        amount: metadata.estimatedHours * rate,
      });
    }

    // Material items based on business type
    if (metadata.materials && metadata.materials.length > 0) {
      const materialItems = this.generateMaterialItems(businessType, metadata.materials);
      items.push(...materialItems);
    }

    return items;
  }

  /**
   * Generate material line items
   */
  private generateMaterialItems(businessType: string, materials: string[]): QuoteLineItem[] {
    const items: QuoteLineItem[] = [];

    const materialCosts: Record<string, Record<string, any>> = {
      carpentry: {
        'Lumber - 2x4': { unit: 'board feet', rate: 2.5, margin: 1.3 },
        'Plywood': { unit: 'sheet', rate: 45, margin: 1.25 },
        'Screws': { unit: 'box', rate: 12, margin: 1.4 },
        'Wood finish': { unit: 'gallon', rate: 35, margin: 1.35 },
      },
      plumbing: {
        'Copper pipe 1/2"': { unit: 'foot', rate: 1.5, margin: 1.4 },
        'PVC pipe': { unit: 'foot', rate: 0.8, margin: 1.35 },
        'Fittings': { unit: 'unit', rate: 5, margin: 1.5 },
        'Valve': { unit: 'unit', rate: 15, margin: 1.3 },
      },
      electrical: {
        'Wire 10 AWG': { unit: 'foot', rate: 0.5, margin: 1.4 },
        'Circuit breaker': { unit: 'unit', rate: 12, margin: 1.35 },
        'Outlet/Switch': { unit: 'unit', rate: 3, margin: 1.5 },
        'Panel upgrade': { unit: 'unit', rate: 200, margin: 1.2 },
      },
      painting: {
        'Interior paint': { unit: 'gallon', rate: 45, margin: 1.25 },
        'Exterior paint': { unit: 'gallon', rate: 65, margin: 1.25 },
        'Primer': { unit: 'gallon', rate: 35, margin: 1.3 },
        'Brushes/Rollers': { unit: 'set', rate: 20, margin: 1.4 },
      },
      default: {
        'Materials': { unit: 'item', rate: 100, margin: 1.3 },
      },
    };

    const costs = materialCosts[businessType] || materialCosts.default;

    materials.forEach((material) => {
      const cost = costs[material] || { unit: 'item', rate: 100, margin: 1.3 };
      const amount = cost.rate * cost.margin;

      items.push({
        description: material,
        quantity: 1,
        unit: cost.unit,
        rate: amount,
        amount,
      });
    });

    return items;
  }

  /**
   * Create quote from measurements and specifications
   */
  createQuoteFromMeasurements(
    clientName: string,
    businessProfile: BusinessProfile,
    measurements: Record<string, number>,
    specifications: string
  ): Quote {
    const metadata = this.analyzeMeasurements(businessProfile.businessType, measurements);
    return this.createQuote(clientName, businessProfile, specifications, metadata);
  }

  /**
   * Analyze measurements and generate metadata
   */
  private analyzeMeasurements(
    businessType: string,
    measurements: Record<string, number>
  ): BidMetadata {
    const metadata: BidMetadata = {
      businessType,
      scope: 'Based on specifications',
      measurements,
      materials: [],
      estimatedHours: 0,
    };

    // Calculate estimates based on type and measurements
    if (businessType === 'carpentry') {
      const area = (measurements.width || 0) * (measurements.length || 0);
      metadata.materials = ['Lumber - 2x4', 'Plywood', 'Screws', 'Wood finish'];
      metadata.estimatedHours = (area / 50) + 8; // Base + area estimate
    } else if (businessType === 'painting') {
      const area = (measurements.width || 0) * (measurements.height || 0) * (measurements.count || 1);
      metadata.materials = ['Interior paint', 'Primer', 'Brushes/Rollers'];
      metadata.estimatedHours = area / 350; // ~350 sq ft per 8 hours
    } else if (businessType === 'plumbing') {
      const distance = (measurements.distance || 0);
      metadata.materials = ['Copper pipe 1/2"', 'Fittings', 'Valve'];
      metadata.estimatedHours = (distance / 30) + 4;
    } else if (businessType === 'landscaping') {
      const area = (measurements.width || 0) * (measurements.length || 0);
      metadata.materials = ['Mulch', 'Plants', 'Landscape fabric', 'Stone'];
      metadata.estimatedHours = (area / 500) + 2;
    }

    return metadata;
  }

  /**
   * Update quote
   */
  updateQuote(quoteId: string, updates: Partial<Quote>): Quote {
    const quote = this.quotes.find((q) => q.id === quoteId);
    if (!quote) throw new Error('Quote not found');

    Object.assign(quote, updates);

    // Recalculate totals if items changed
    if (updates.items) {
      quote.subtotal = quote.items.reduce((sum, item) => sum + item.amount, 0);
      quote.tax = quote.subtotal * quote.taxRate;
      quote.total = quote.subtotal + quote.tax;
    }

    this.saveQuotes();
    return quote;
  }

  /**
   * Send quote to client (generate shareable version)
   */
  generateShareableQuote(quoteId: string): string {
    const quote = this.quotes.find((q) => q.id === quoteId);
    if (!quote) throw new Error('Quote not found');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: auto; padding: 20px;">
        <h1>${quote.businessName}</h1>
        <h2>Quote #${quote.id.slice(0, 8)}</h2>
        
        <p><strong>To:</strong> ${quote.clientName}</p>
        <p><strong>Date:</strong> ${quote.quoteDate}</p>
        <p><strong>Valid Until:</strong> ${quote.validUntil}</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background-color: #f0f0f0;">
            <th style="border: 1px solid #ddd; padding: 8px;">Description</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Qty</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Unit</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Rate</th>
            <th style="border: 1px solid #ddd; padding: 8px;">Amount</th>
          </tr>
          ${quote.items
            .map(
              (item) => `
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">${item.description}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${item.quantity}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${item.unit}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">$${item.rate.toFixed(2)}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">$${item.amount.toFixed(2)}</td>
            </tr>
          `
            )
            .join('')}
        </table>
        
        <div style="text-align: right; margin-top: 20px;">
          <p><strong>Subtotal:</strong> $${quote.subtotal.toFixed(2)}</p>
          <p><strong>Tax (${(quote.taxRate * 100).toFixed(0)}%):</strong> $${quote.tax.toFixed(2)}</p>
          <h3><strong>Total:</strong> $${quote.total.toFixed(2)}</h3>
        </div>
        
        ${quote.notes ? `<p><strong>Notes:</strong> ${quote.notes}</p>` : ''}
      </div>
    `;

    return html;
  }

  /**
   * Get quotes for client
   */
  getClientQuotes(clientName: string): Quote[] {
    return this.quotes.filter((q) => q.clientName === clientName);
  }

  /**
   * Get all quotes
   */
  getAllQuotes(): Quote[] {
    return this.quotes;
  }

  /**
   * Save quotes to storage
   */
  private saveQuotes(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.quotes));
    } catch (e) {
      console.warn('Failed to save quotes:', e);
    }
  }

  /**
   * Load quotes from storage
   */
  loadQuotes(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      this.quotes = stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.warn('Failed to load quotes:', e);
    }
  }
}

export const quotingSystem = new QuotingSystem();
