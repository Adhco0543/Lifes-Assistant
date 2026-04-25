/**
 * JobExtractor: Parse and extract job details from voice transcripts
 * Uses pattern matching and NLP to identify key job information
 */

export interface JobDetails {
  title?: string;
  company?: string;
  description?: string;
  location?: string;
  salary?: string;
  salaryMin?: number;
  salaryMax?: number;
  jobType?: "full-time" | "part-time" | "contract" | "temporary" | "unknown";
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  startDate?: string;
  deadline?: string;
  notes?: string;
  confidence: number;
  extractedFields: string[];
}

class JobExtractorClass {
  private static instance: JobExtractorClass;

  private constructor() {}

  static getInstance(): JobExtractorClass {
    if (!JobExtractorClass.instance) {
      JobExtractorClass.instance = new JobExtractorClass();
    }
    return JobExtractorClass.instance;
  }

  /**
   * Extract job details from transcript
   */
  extractJobDetails(transcript: string): JobDetails {
    const details: JobDetails = {
      confidence: 0,
      extractedFields: [],
    };

    if (!transcript || transcript.trim().length === 0) {
      return { ...details, confidence: 0 };
    }

    const text = transcript.toLowerCase();
    let matchCount = 0;
    let totalPossible = 10; // Job title, company, description, location, salary, type, contact, start, deadline, notes

    // Extract job title
    const titleMatch = this.extractJobTitle(text);
    if (titleMatch) {
      details.title = titleMatch;
      details.extractedFields.push("title");
      matchCount++;
    }

    // Extract company
    const companyMatch = this.extractCompany(text);
    if (companyMatch) {
      details.company = companyMatch;
      details.extractedFields.push("company");
      matchCount++;
    }

    // Extract location
    const locationMatch = this.extractLocation(text);
    if (locationMatch) {
      details.location = locationMatch;
      details.extractedFields.push("location");
      matchCount++;
    }

    // Extract salary
    const salaryMatch = this.extractSalary(text);
    if (salaryMatch) {
      details.salary = salaryMatch.display;
      details.salaryMin = salaryMatch.min;
      details.salaryMax = salaryMatch.max;
      details.extractedFields.push("salary");
      matchCount++;
    }

    // Extract job type
    const jobTypeMatch = this.extractJobType(text);
    if (jobTypeMatch) {
      details.jobType = jobTypeMatch;
      details.extractedFields.push("jobType");
      matchCount++;
    }

    // Extract contact information
    const contactMatch = this.extractContact(text);
    if (contactMatch) {
      if (contactMatch.name) {
        details.contactName = contactMatch.name;
        details.extractedFields.push("contactName");
      }
      if (contactMatch.phone) {
        details.contactPhone = contactMatch.phone;
        details.extractedFields.push("contactPhone");
      }
      if (contactMatch.email) {
        details.contactEmail = contactMatch.email;
        details.extractedFields.push("contactEmail");
      }
      matchCount++;
    }

    // Extract dates
    const datesMatch = this.extractDates(text);
    if (datesMatch) {
      if (datesMatch.startDate) {
        details.startDate = datesMatch.startDate;
        details.extractedFields.push("startDate");
      }
      if (datesMatch.deadline) {
        details.deadline = datesMatch.deadline;
        details.extractedFields.push("deadline");
      }
      matchCount++;
    }

    // Extract description/notes
    const descMatch = this.extractDescription(text);
    if (descMatch) {
      details.description = descMatch;
      details.extractedFields.push("description");
      matchCount++;
    }

    // Extract additional notes
    const notesMatch = this.extractNotes(text);
    if (notesMatch) {
      details.notes = notesMatch;
      details.extractedFields.push("notes");
      matchCount++;
    }

    // Calculate confidence (0-100)
    details.confidence = Math.round((matchCount / totalPossible) * 100);

    return details;
  }

  private extractJobTitle(text: string): string | undefined {
    const patterns = [
      /(?:position|title|role|opening|hiring for|looking for)[\s:]*([a-z\s]+?)(?:\s(?:at|for|in|with|position|role|job)|$)/,
      /([a-z\s]{3,50})\s+(?:position|role|job|opening|opportunity)/,
      /([a-z]+\s+(?:engineer|developer|manager|coordinator|specialist|analyst|designer|architect|lead))/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return this.capitalizeWords(match[1].trim());
      }
    }

    return undefined;
  }

  private extractCompany(text: string): string | undefined {
    const patterns = [
      /(?:company|organization|employer|at|working at|for|works at)[\s:]*([a-z\s&.,]{3,50}?)(?:\s(?:is|has|needs|located|in|company)|$)/,
      /(?:^|[\s.])([a-z]{2,}(?:\s[a-z]{2,})*)\s+(?:is hiring|is looking|needs|has a|posted)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const company = match[1].trim();
        if (company.length > 2 && company.length < 50) {
          return this.capitalizeWords(company);
        }
      }
    }

    return undefined;
  }

  private extractLocation(text: string): string | undefined {
    const patterns = [
      /(?:location|located|based|in|remote)[\s:]*([a-z\s,]{2,50}?)(?:\s(?:or|and|near|area|region)|$)/,
      /(?:in|at|located)\s+([a-z]+(?:\s*,\s*[a-z]+)*)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const location = match[1].trim();
        if (!["is", "has", "the", "a", "an"].includes(location)) {
          return this.capitalizeWords(location);
        }
      }
    }

    return undefined;
  }

  private extractSalary(
    text: string
  ): { display: string; min?: number; max?: number } | undefined {
    const patterns = [
      /(?:salary|pay|compensation|range|wage)[\s:]*\$?(\d{2,3})[,k]?\s*(?:to|-|and)\s*\$?(\d{2,3})[,k]?/,
      /(?:salary|pay|compensation)[\s:]*\$?([\d,.]+)\s*(?:per|a|annually|yearly|monthly|hourly)/,
      /\$?(\d{2,3})[,k]\s*(?:to|-)\s*\$?(\d{2,3})[,k]/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const min = parseInt(match[1]) * 1000;
        const max = match[2] ? parseInt(match[2]) * 1000 : undefined;
        const display = max ? `$${min}-$${max}` : `$${min}`;
        return { display, min, max };
      }
    }

    return undefined;
  }

  private extractJobType(
    text: string
  ): "full-time" | "part-time" | "contract" | "temporary" | "unknown" | undefined {
    if (text.includes("full-time") || text.includes("fulltime") || text.includes("full time")) {
      return "full-time";
    }
    if (text.includes("part-time") || text.includes("parttime") || text.includes("part time")) {
      return "part-time";
    }
    if (text.includes("contract")) {
      return "contract";
    }
    if (text.includes("temporary") || text.includes("temp")) {
      return "temporary";
    }
    return undefined;
  }

  private extractContact(text: string): {
    name?: string;
    phone?: string;
    email?: string;
  } | undefined {
    const contact: { name?: string; phone?: string; email?: string } = {};

    // Extract email
    const emailPattern = /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/;
    const emailMatch = text.match(emailPattern);
    if (emailMatch) {
      contact.email = emailMatch[1];
    }

    // Extract phone
    const phonePattern = /(?:phone|call|reach|contact)[\s:]*(?:\+?1[\s.-]?)?\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/;
    const phoneMatch = text.match(phonePattern);
    if (phoneMatch) {
      contact.phone = `${phoneMatch[1]}-${phoneMatch[2]}-${phoneMatch[3]}`;
    }

    // Extract name
    const namePattern = /(?:contact|ask for|call|reach|speak to|mention)[\s:]*([a-z]{2,}\s+[a-z]{2,})/;
    const nameMatch = text.match(namePattern);
    if (nameMatch) {
      contact.name = this.capitalizeWords(nameMatch[1]);
    }

    return Object.keys(contact).length > 0 ? contact : undefined;
  }

  private extractDates(text: string): { startDate?: string; deadline?: string } | undefined {
    const dates: { startDate?: string; deadline?: string } = {};

    // Extract start date
    const startPattern = /(?:start|begin|available|start date)[\s:]*([a-z]+\s+\d{1,2}(?:st|nd|rd|th)?)/;
    const startMatch = text.match(startPattern);
    if (startMatch) {
      dates.startDate = startMatch[1];
    }

    // Extract deadline
    const deadlinePattern = /(?:deadline|due|apply by|by|closes)[\s:]*([a-z]+\s+\d{1,2}(?:st|nd|rd|th)?)/;
    const deadlineMatch = text.match(deadlinePattern);
    if (deadlineMatch) {
      dates.deadline = deadlineMatch[1];
    }

    return Object.keys(dates).length > 0 ? dates : undefined;
  }

  private extractDescription(text: string): string | undefined {
    // Extract key responsibilities and requirements
    const patterns = [
      /(?:responsible for|duties|responsibilities|role includes)[\s:]*([a-z\s.,]{20,200})/,
      /(?:they|you|we)\s+(?:are looking|need|require|want|seek)[\s:]*(?:someone|a person|to)?\s*([a-z\s.,]{20,200})/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private extractNotes(text: string): string | undefined {
    // Extract any additional notes or context
    const patterns = [
      /(?:note|important|remember|fyi)[\s:]*([a-z\s.,]{10,150})/,
      /(?:also|additionally)[\s:]*([a-z\s.,]{10,150})/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private capitalizeWords(str: string): string {
    return str
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
}

export const jobExtractor = JobExtractorClass.getInstance();
