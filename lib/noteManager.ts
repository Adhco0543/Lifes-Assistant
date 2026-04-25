/**
 * Smart Note-Taking System
 * Intelligent note organization and retrieval
 */

export interface Note {
  id: string;
  title: string;
  content: string;
  type: 'general' | 'measurement' | 'specification' | 'idea' | 'client' | 'project';
  createdAt: number;
  updatedAt: number;
  projectId?: string;
  clientId?: string;
  clientName?: string;
  tags: string[];
  importance: 'low' | 'medium' | 'high';
  measurements?: Record<string, number>;
  linkedNotes?: string[];
}

export interface NoteCategory {
  name: string;
  color: string;
  icon: string;
}

class NoteManager {
  private notes: Note[] = [];
  private storageKey = 'notes';
  private categories: Record<string, NoteCategory> = {
    measurement: { name: 'Measurement', color: '#00BCD4', icon: '📐' },
    specification: { name: 'Specification', color: '#4CAF50', icon: '📋' },
    idea: { name: 'Idea', color: '#FFC107', icon: '💡' },
    client: { name: 'Client Info', color: '#FF9800', icon: '👤' },
    project: { name: 'Project', color: '#9C27B0', icon: '📁' },
    general: { name: 'General', color: '#607D8B', icon: '📝' },
  };

  constructor() {
    // Only load notes on client-side, not during SSR
    if (typeof window !== 'undefined') {
      this.loadNotes();
    }
  }

  /**
   * Create new note
   */
  createNote(
    title: string,
    content: string,
    type: Note['type'] = 'general',
    metadata?: {
      projectId?: string;
      clientId?: string;
      clientName?: string;
      measurements?: Record<string, number>;
      tags?: string[];
    }
  ): Note {
    const note: Note = {
      id: `note-${Date.now()}-${Math.random()}`,
      title,
      content,
      type,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      projectId: metadata?.projectId,
      clientId: metadata?.clientId,
      clientName: metadata?.clientName,
      tags: metadata?.tags || this.extractTags(content),
      importance: this.calculateImportance(content),
      measurements: metadata?.measurements,
      linkedNotes: [],
    };

    this.notes.push(note);
    this.saveNotes();

    return note;
  }

  /**
   * Extract tags from content
   */
  private extractTags(content: string): string[] {
    const tagMatches = content.match(/#\w+/g) || [];
    return tagMatches.map((tag) => tag.slice(1).toLowerCase());
  }

  /**
   * Calculate importance based on keywords
   */
  private calculateImportance(content: string): Note['importance'] {
    const lowerContent = content.toLowerCase();

    if (
      lowerContent.includes('urgent') ||
      lowerContent.includes('asap') ||
      lowerContent.includes('important') ||
      lowerContent.includes('critical')
    ) {
      return 'high';
    }

    if (
      lowerContent.includes('soon') ||
      lowerContent.includes('priority') ||
      lowerContent.includes('deadline')
    ) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Create measurement note
   */
  createMeasurementNote(
    projectOrClient: string,
    measurements: Record<string, number>,
    notes: string = ''
  ): Note {
    const title = `Measurements - ${projectOrClient}`;
    const content = `
Measurements for: ${projectOrClient}
${Object.entries(measurements)
  .map(([key, value]) => `${key}: ${value}`)
  .join('\n')}

${notes}
    `.trim();

    return this.createNote(title, content, 'measurement', {
      measurements,
      tags: ['measurement', projectOrClient.toLowerCase()],
    });
  }

  /**
   * Create client note
   */
  createClientNote(clientName: string, clientInfo: Record<string, string>): Note {
    const content = `
Client: ${clientName}
${Object.entries(clientInfo)
  .map(([key, value]) => `${key}: ${value}`)
  .join('\n')}
    `.trim();

    return this.createNote(`Client Info - ${clientName}`, content, 'client', {
      clientName,
      tags: ['client', clientName.toLowerCase()],
    });
  }

  /**
   * Create project note
   */
  createProjectNote(projectName: string, details: string, projectId: string): Note {
    return this.createNote(`Project - ${projectName}`, details, 'project', {
      projectId,
      tags: ['project', projectName.toLowerCase()],
    });
  }

  /**
   * Search notes
   */
  searchNotes(query: string): Note[] {
    const lowerQuery = query.toLowerCase();

    return this.notes.filter(
      (note) =>
        note.title.toLowerCase().includes(lowerQuery) ||
        note.content.toLowerCase().includes(lowerQuery) ||
        note.tags.some((tag) => tag.includes(lowerQuery)) ||
        note.clientName?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get notes by type
   */
  getNotesByType(type: Note['type']): Note[] {
    return this.notes.filter((note) => note.type === type);
  }

  /**
   * Get notes by client
   */
  getNotesByClient(clientName: string): Note[] {
    return this.notes.filter((note) => note.clientName === clientName);
  }

  /**
   * Get notes by project
   */
  getNotesByProject(projectId: string): Note[] {
    return this.notes.filter((note) => note.projectId === projectId);
  }

  /**
   * Get notes by tag
   */
  getNotesByTag(tag: string): Note[] {
    return this.notes.filter((note) => note.tags.includes(tag.toLowerCase()));
  }

  /**
   * Get recent notes
   */
  getRecentNotes(limit: number = 10): Note[] {
    return this.notes
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }

  /**
   * Get important notes
   */
  getImportantNotes(): Note[] {
    return this.notes
      .filter((note) => note.importance === 'high' || note.importance === 'medium')
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Update note
   */
  updateNote(noteId: string, updates: Partial<Note>): Note {
    const note = this.notes.find((n) => n.id === noteId);
    if (!note) throw new Error('Note not found');

    Object.assign(note, updates, { updatedAt: Date.now() });
    this.saveNotes();

    return note;
  }

  /**
   * Delete note
   */
  deleteNote(noteId: string): void {
    this.notes = this.notes.filter((n) => n.id !== noteId);
    this.saveNotes();
  }

  /**
   * Link notes together
   */
  linkNotes(noteId1: string, noteId2: string): void {
    const note1 = this.notes.find((n) => n.id === noteId1);
    const note2 = this.notes.find((n) => n.id === noteId2);

    if (!note1 || !note2) throw new Error('One or both notes not found');

    if (!note1.linkedNotes?.includes(noteId2)) {
      note1.linkedNotes?.push(noteId2);
    }
    if (!note2.linkedNotes?.includes(noteId1)) {
      note2.linkedNotes?.push(noteId1);
    }

    this.saveNotes();
  }

  /**
   * Get linked notes
   */
  getLinkedNotes(noteId: string): Note[] {
    const note = this.notes.find((n) => n.id === noteId);
    if (!note || !note.linkedNotes) return [];

    return note.linkedNotes
      .map((id) => this.notes.find((n) => n.id === id))
      .filter((n) => n !== undefined) as Note[];
  }

  /**
   * Export notes as text
   */
  exportAsText(noteIds?: string[]): string {
    const notesToExport = noteIds
      ? this.notes.filter((n) => noteIds.includes(n.id))
      : this.notes;

    return notesToExport
      .map(
        (note) => `
=== ${note.title} ===
Type: ${note.type}
Created: ${new Date(note.createdAt).toLocaleDateString()}
Tags: ${note.tags.join(', ')}
Importance: ${note.importance}

${note.content}

${note.measurements ? `Measurements:\n${Object.entries(note.measurements).map(([k, v]) => `${k}: ${v}`).join('\n')}\n` : ''}
      `
      )
      .join('\n\n');
  }

  /**
   * Get all notes
   */
  getAllNotes(): Note[] {
    return this.notes;
  }

  /**
   * Save notes to storage
   */
  private saveNotes(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.notes));
    } catch (e) {
      console.warn('Failed to save notes:', e);
    }
  }

  /**
   * Load notes from storage
   */
  private loadNotes(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      this.notes = stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.warn('Failed to load notes:', e);
    }
  }

  /**
   * Get note statistics
   */
  getStatistics(): Record<string, any> {
    return {
      totalNotes: this.notes.length,
      byType: this.notes.reduce((acc, note) => {
        acc[note.type] = (acc[note.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      totalMeasurements: this.notes.filter((n) => n.type === 'measurement').length,
      importantNotes: this.notes.filter((n) => n.importance === 'high').length,
      allTags: Array.from(new Set(this.notes.flatMap((n) => n.tags))),
    };
  }
}

export const noteManager = new NoteManager();
