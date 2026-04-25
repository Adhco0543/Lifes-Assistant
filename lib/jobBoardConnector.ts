/**
 * jobBoardConnector.ts - Connect to job boards and extract opportunities
 * Supports: Indeed, ZipRecruiter, LinkedIn
 */

export interface JobOpportunity {
  id: string;
  source: "indeed" | "ziprecruiter" | "linkedin";
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  salary?: { min: number; max: number };
  postedDate: Date;
  requirements: string[];
  contactEmail?: string;
  contactPhone?: string;
}

export interface SearchCriteria {
  keywords: string[];
  location: string;
  radius?: number;
  salaryMin?: number;
  salaryMax?: number;
  jobType?: "full-time" | "contract" | "hourly" | "all";
  industry?: string;
}

class JobBoardConnectorClass {
  private static instance: JobBoardConnectorClass;
  private cache: Map<string, JobOpportunity[]> = new Map();
  private lastSearch: Map<string, Date> = new Map();

  private constructor() {}

  static getInstance(): JobBoardConnectorClass {
    if (!JobBoardConnectorClass.instance) {
      JobBoardConnectorClass.instance = new JobBoardConnectorClass();
    }
    return JobBoardConnectorClass.instance;
  }

  /**
   * Search all job boards
   */
  async searchAll(criteria: SearchCriteria): Promise<JobOpportunity[]> {
    const cacheKey = this.getCacheKey(criteria);
    
    // Check cache (valid for 6 hours)
    const cached = this.cache.get(cacheKey);
    const lastSearchTime = this.lastSearch.get(cacheKey);
    
    if (
      cached &&
      lastSearchTime &&
      Date.now() - lastSearchTime.getTime() < 6 * 60 * 60 * 1000
    ) {
      return cached;
    }

    const results: JobOpportunity[] = [];

    // Search multiple sources in parallel
    const [indeedJobs, ziprecruiterJobs, linkedinJobs] = await Promise.all([
      this.searchIndeed(criteria).catch((e) => {
        console.error("Indeed search error:", e);
        return [];
      }),
      this.searchZipRecruiter(criteria).catch((e) => {
        console.error("ZipRecruiter search error:", e);
        return [];
      }),
      this.searchLinkedIn(criteria).catch((e) => {
        console.error("LinkedIn search error:", e);
        return [];
      }),
    ]);

    results.push(...indeedJobs, ...ziprecruiterJobs, ...linkedinJobs);

    // Remove duplicates
    const uniqueResults = this.deduplicateJobs(results);

    // Cache results
    this.cache.set(cacheKey, uniqueResults);
    this.lastSearch.set(cacheKey, new Date());

    return uniqueResults;
  }

  /**
   * Search Indeed
   */
  private async searchIndeed(criteria: SearchCriteria): Promise<JobOpportunity[]> {
    try {
      // In production, use Indeed API or web scraping
      const query = criteria.keywords.join(" ");
      const url = `https://www.indeed.com/jobs?q=${encodeURIComponent(query)}&l=${encodeURIComponent(criteria.location)}`;

      // This would typically use puppeteer or cheerio to scrape
      // For now, return mock data
      return this.generateMockJobs("indeed", criteria, 5);
    } catch (error) {
      console.error("Indeed search failed:", error);
      return [];
    }
  }

  /**
   * Search ZipRecruiter
   */
  private async searchZipRecruiter(
    criteria: SearchCriteria
  ): Promise<JobOpportunity[]> {
    try {
      // In production, use ZipRecruiter API
      // API key would be stored in env vars
      const apiKey = process.env.ZIPRECRUITER_API_KEY;

      if (!apiKey) {
        return [];
      }

      // Mock implementation
      return this.generateMockJobs("ziprecruiter", criteria, 5);
    } catch (error) {
      console.error("ZipRecruiter search failed:", error);
      return [];
    }
  }

  /**
   * Search LinkedIn
   */
  private async searchLinkedIn(criteria: SearchCriteria): Promise<JobOpportunity[]> {
    try {
      // LinkedIn doesn't have a public API for job searches
      // Would need LinkedIn Recruiter API (enterprise)
      // For now, return mock data
      return this.generateMockJobs("linkedin", criteria, 3);
    } catch (error) {
      console.error("LinkedIn search failed:", error);
      return [];
    }
  }

  /**
   * Generate mock job opportunities for testing
   */
  private generateMockJobs(
    source: "indeed" | "ziprecruiter" | "linkedin",
    criteria: SearchCriteria,
    count: number
  ): JobOpportunity[] {
    const companies = [
      "Acme Corp",
      "TechStart Inc",
      "Global Solutions",
      "Future Systems",
      "Innovation Labs",
    ];
    const jobTitles = [
      "Senior Developer",
      "Project Manager",
      "Business Analyst",
      "Operations Lead",
      "Account Executive",
    ];

    const jobs: JobOpportunity[] = [];

    for (let i = 0; i < count; i++) {
      jobs.push({
        id: `${source}-${Date.now()}-${i}`,
        source,
        title: jobTitles[i % jobTitles.length],
        company: companies[i % companies.length],
        location: criteria.location,
        description: `Exciting opportunity for a ${jobTitles[i % jobTitles.length]} with ${criteria.keywords.join(", ")} skills.`,
        url: `https://${source}.com/jobs/${i}`,
        salary: {
          min: criteria.salaryMin || 60000,
          max: criteria.salaryMax || 120000,
        },
        postedDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        requirements: criteria.keywords.slice(0, 3),
        contactEmail: `hiring@${companies[i % companies.length].toLowerCase().replace(" ", "")}.com`,
      });
    }

    return jobs;
  }

  /**
   * Remove duplicate jobs
   */
  private deduplicateJobs(jobs: JobOpportunity[]): JobOpportunity[] {
    const seen = new Set<string>();
    const unique: JobOpportunity[] = [];

    for (const job of jobs) {
      const key = `${job.title.toLowerCase()}-${job.company.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(job);
      }
    }

    return unique;
  }

  /**
   * Get cache key from search criteria
   */
  private getCacheKey(criteria: SearchCriteria): string {
    return `${criteria.keywords.join(",")}|${criteria.location}|${criteria.salaryMin || ""}|${criteria.salaryMax || ""}`;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.lastSearch.clear();
  }
}

export const jobBoardConnector = JobBoardConnectorClass.getInstance();
