'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAppIntegration, useResponsive } from '../lib/hooks';
import { noteManager, Note } from '../lib/noteManager';
import { RichMedia } from './Richmedia';

type NoteType = 'general' | 'measurement' | 'specification' | 'idea' | 'client' | 'project';

interface NoteEditorProps {
  userId: string;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ userId }) => {
  const { isMobile } = useResponsive();
  const integration = useAppIntegration(userId);

  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [view, setView] = useState<'list' | 'edit' | 'create'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<NoteType | 'all'>('all');
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editType, setEditType] = useState<NoteType>('general');
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Note types available
  const noteTypes: NoteType[] = ['general', 'measurement', 'specification', 'idea', 'client', 'project'];

  // Load notes on mount
  useEffect(() => {
    const loadNotes = async () => {
      try {
        const allNotes = noteManager.getAllNotes();
        setNotes(allNotes);
        setIsLoading(false);

        integration.trackUserAction('notes_view', 'note_editor', {
          totalNotes: allNotes.length,
        });
      } catch (error) {
        console.error('Error loading notes:', error);
        setIsLoading(false);
      }
    };

    loadNotes();
  }, [userId, integration]);

  // Filter notes based on search and type
  useEffect(() => {
    let filtered = notes;

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter((note) => note.type === selectedType);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (note) =>
          note.title.toLowerCase().includes(query) ||
          note.content.toLowerCase().includes(query) ||
          note.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    setFilteredNotes(filtered);
  }, [notes, selectedType, searchQuery]);

  /**
   * Create new note
   */
  const handleCreateNote = useCallback(() => {
    if (!editTitle.trim() || !editContent.trim()) {
      alert('Please enter title and content');
      return;
    }

    try {
      const newNote = noteManager.createNote(
        editTitle,
        editContent,
        editType,
        {
          tags: editTags,
        }
      );

      setNotes((prev) => [newNote, ...prev]);
      setEditTitle('');
      setEditContent('');
      setEditTags([]);
      setEditType('general');
      setView('list');

      integration.trackUserAction('note_created', 'note_editor', {
        type: editType,
        tags: editTags.length,
      });
    } catch (error) {
      console.error('Error creating note:', error);
      alert('Error creating note');
    }
  }, [editTitle, editContent, editType, editTags, integration]);

  /**
   * Update existing note
   */
  const handleUpdateNote = useCallback(() => {
    if (!selectedNote || !editTitle.trim() || !editContent.trim()) {
      alert('Please enter title and content');
      return;
    }

    try {
      const updated: Note = {
        ...selectedNote,
        title: editTitle,
        content: editContent,
        tags: editTags,
        type: editType,
        updatedAt: Date.now(),
      };

      noteManager.updateNote(updated.id, {
        title: editTitle,
        content: editContent,
        tags: editTags,
        type: editType,
      });
      setNotes((prev) =>
        prev.map((note) => (note.id === updated.id ? updated : note))
      );
      setSelectedNote(updated);
      setView('list');

      integration.trackUserAction('note_updated', 'note_editor', {
        type: editType,
      });
    } catch (error) {
      console.error('Error updating note:', error);
      alert('Error updating note');
    }
  }, [selectedNote, editTitle, editContent, editTags, editType, integration]);

  /**
   * Delete note
   */
  const handleDeleteNote = useCallback(
    (noteId: string) => {
      if (confirm('Are you sure you want to delete this note?')) {
        try {
          noteManager.deleteNote(noteId);
          setNotes((prev) => prev.filter((n) => n.id !== noteId));
          if (selectedNote?.id === noteId) {
            setSelectedNote(null);
          }
          setView('list');

          integration.trackUserAction('note_deleted', 'note_editor', {
            noteId,
          });
        } catch (error) {
          console.error('Error deleting note:', error);
          alert('Error deleting note');
        }
      }
    },
    [selectedNote, integration]
  );

  /**
   * Export notes
   */
  const handleExportNotes = useCallback(() => {
    try {
      const noteIds = filteredNotes.map((n) => n.id);
      const text = noteManager.exportAsText(noteIds);
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'notes.txt';
      link.click();

      integration.trackUserAction('notes_exported', 'note_editor', {
        count: filteredNotes.length,
      });
    } catch (error) {
      console.error('Error exporting notes:', error);
      alert('Error exporting notes');
    }
  }, [filteredNotes, integration]);

  /**
   * Start editing a note
   */
  const handleEditNote = (note: Note) => {
    setSelectedNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditTags(note.tags);
    setEditType(note.type);
    setView('edit');

    integration.trackUserAction('note_edit_start', 'note_editor', {
      noteId: note.id,
    });
  };

  /**
   * Start creating new note
   */
  const handleNewNote = () => {
    setSelectedNote(null);
    setEditTitle('');
    setEditContent('');
    setEditTags([]);
    setEditType('general');
    setView('create');

    integration.trackUserAction('note_create_start', 'note_editor', {});
  };

  if (isLoading) {
    return (
      <div className="editor-loading">
        <RichMedia type="animation" animation="pulse" size="lg" />
        <p>Loading notes...</p>
      </div>
    );
  }

  return (
    <div className={`note-editor ${isMobile ? 'mobile' : ''}`}>
      {/* Header */}
      <div className="editor-header">
        <h2>
          <RichMedia icon="heart" size="lg" /> Notes
        </h2>
        <p>Organize and capture project information</p>
      </div>

      {view === 'list' ? (
        /* List View */
        <>
          {/* Toolbar */}
          <div className="editor-toolbar">
            <div className="search-bar">
              <input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <RichMedia icon="arrow" size="sm" />
            </div>

            <div className="filter-buttons">
              <button
                className={`filter-btn ${selectedType === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedType('all')}
              >
                All ({notes.length})
              </button>
              {noteTypes.map((type) => {
                const count = notes.filter((n) => n.type === type).length;
                return (
                  <button
                    key={type}
                    className={`filter-btn ${selectedType === type ? 'active' : ''}`}
                    onClick={() => setSelectedType(type)}
                  >
                    {type} ({count})
                  </button>
                );
              })}
            </div>

            <div className="toolbar-actions">
              <button className="action-btn export" onClick={handleExportNotes}>
                Export
              </button>
              <button className="action-btn create" onClick={handleNewNote}>
                + New Note
              </button>
            </div>
          </div>

          {/* Notes List */}
          <div className="notes-list">
            {filteredNotes.length === 0 ? (
              <div className="empty-state">
                <RichMedia type="visual" size="lg" />
                <h3>No notes found</h3>
                <p>Create your first note to get started</p>
                <button className="btn-primary" onClick={handleNewNote}>
                  Create Note
                </button>
              </div>
            ) : (
              filteredNotes.map((note) => (
                <div key={note.id} className="note-item">
                  <div className="note-header">
                    <div className="note-title-section">
                      <h3>{note.title}</h3>
                      <span className={`note-type ${note.type}`}>{note.type}</span>
                    </div>
                    <span className="note-date">
                      {new Date(note.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="note-preview">{note.content.substring(0, 100)}...</p>

                  {note.tags.length > 0 && (
                    <div className="note-tags">
                      {note.tags.map((tag, idx) => (
                        <span key={idx} className="tag">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="note-actions">
                    <button
                      className="action-btn view"
                      onClick={() => handleEditNote(note)}
                    >
                      Edit
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => handleDeleteNote(note.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        /* Edit/Create View */
        <div className="editor-form">
          <div className="form-header">
            <h3>{view === 'create' ? 'Create New Note' : 'Edit Note'}</h3>
            <button className="close-btn" onClick={() => setView('list')}>
              ✕
            </button>
          </div>

          <div className="form-group">
            <label>Title *</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Note title"
            />
          </div>

          <div className="form-group">
            <label>Type</label>
            <select value={editType} onChange={(e) => setEditType(e.target.value as NoteType)}>
              {noteTypes.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Content *</label>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Note content..."
              rows={8}
            />
          </div>

          <div className="form-group">
            <label>Tags</label>
            <input
              type="text"
              placeholder="Add tags separated by commas"
              onChange={(e) => setEditTags(e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
              value={editTags.join(', ')}
            />
            {editTags.length > 0 && (
              <div className="tags-preview">
                {editTags.map((tag, idx) => (
                  <span key={idx} className="tag">
                    #{tag}
                    <button
                      className="tag-remove"
                      onClick={() => setEditTags((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setView('list')}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={view === 'create' ? handleCreateNote : handleUpdateNote}
            >
              {view === 'create' ? 'Create Note' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .note-editor {
          background: white;
          border-radius: 1rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .editor-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 400px;
          color: #999;
        }

        .editor-header {
          background: linear-gradient(135deg, #66bb6a 0%, #43a047 100%);
          color: white;
          padding: 2rem;
        }

        .editor-header h2 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .editor-header p {
          margin: 0.5rem 0 0;
          opacity: 0.9;
        }

        .editor-toolbar {
          padding: 1.5rem;
          border-bottom: 2px solid #f0f0f0;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .search-bar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #f5f5f5;
          border-radius: 0.5rem;
          padding: 0 1rem;
        }

        .search-bar input {
          flex: 1;
          border: none;
          background: none;
          padding: 0.75rem;
          font-size: 1rem;
          font-family: inherit;
        }

        .search-bar input:focus {
          outline: none;
        }

        .filter-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .filter-btn {
          padding: 0.5rem 1rem;
          background: #f5f5f5;
          border: 2px solid transparent;
          border-radius: 2rem;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .filter-btn:hover {
          background: #eeeeee;
        }

        .filter-btn.active {
          background: #66bb6a;
          color: white;
          border-color: #43a047;
        }

        .toolbar-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
        }

        .action-btn {
          padding: 0.5rem 1rem;
          border: 2px solid #e0e0e0;
          background: white;
          border-radius: 0.4rem;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .action-btn:hover {
          border-color: #66bb6a;
          color: #66bb6a;
        }

        .action-btn.export {
          border-color: #2196f3;
          color: #2196f3;
        }

        .action-btn.create {
          background: #66bb6a;
          color: white;
          border-color: #43a047;
        }

        .action-btn.create:hover {
          background: #43a047;
        }

        .notes-list {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          flex: 1;
          color: #999;
        }

        .empty-state h3 {
          margin: 1rem 0 0.5rem;
          color: #333;
        }

        .empty-state .btn-primary {
          margin-top: 1rem;
        }

        .note-item {
          border: 2px solid #f0f0f0;
          border-radius: 0.75rem;
          padding: 1.5rem;
          transition: all 0.2s ease;
        }

        .note-item:hover {
          border-color: #66bb6a;
          box-shadow: 0 4px 12px rgba(102, 187, 106, 0.1);
        }

        .note-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.75rem;
        }

        .note-title-section {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .note-title-section h3 {
          margin: 0;
          font-size: 1.1rem;
          color: #333;
        }

        .note-type {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          background: #f0f0f0;
          border-radius: 2rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: #666;
          text-transform: capitalizee;
        }

        .note-type.measurement {
          background: #e3f2fd;
          color: #1976d2;
        }

        .note-type.specification {
          background: #f3e5f5;
          color: #7b1fa2;
        }

        .note-type.client {
          background: #fce4ec;
          color: #c2185b;
        }

        .note-date {
          font-size: 0.85rem;
          color: #999;
        }

        .note-preview {
          margin: 0.75rem 0;
          color: #666;
          font-size: 0.95rem;
          line-height: 1.5;
        }

        .note-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .tag {
          display: inline-block;
          padding: 0.375rem 0.75rem;
          background: #e8f5e9;
          color: #2e7d32;
          border-radius: 2rem;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .tag-remove {
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          margin-left: 0.5rem;
          font-weight: bold;
        }

        .note-actions {
          display: flex;
          gap: 0.5rem;
        }

        .action-btn.view {
          flex: 1;
          background: #66bb6a;
          color: white;
          border-color: #43a047;
        }

        .action-btn.view:hover {
          background: #43a047;
        }

        .action-btn.delete {
          flex: 1;
          color: #f44336;
          border-color: #f44336;
        }

        .action-btn.delete:hover {
          background: #f44336;
          color: white;
        }

        .editor-form {
          padding: 2rem;
          flex: 1;
          overflow-y: auto;
        }

        .form-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .form-header h3 {
          margin: 0;
          font-size: 1.3rem;
          color: #333;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #999;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }

        .form-group label {
          font-weight: 600;
          color: #333;
          font-size: 0.95rem;
        }

        .form-group input,
        .form-group textarea,
        .form-group select {
          padding: 0.75rem;
          border: 2px solid #e0e0e0;
          border-radius: 0.5rem;
          font-family: inherit;
          font-size: 1rem;
          transition: all 0.2s ease;
        }

        .form-group input:focus,
        .form-group textarea:focus,
        .form-group select:focus {
          outline: none;
          border-color: #66bb6a;
          box-shadow: 0 0 0 3px rgba(102, 187, 106, 0.1);
        }

        .tags-preview {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }

        .form-actions {
          display: flex;
          gap: 1rem;
          margin-top: 2rem;
        }

        .btn-primary,
        .btn-secondary {
          padding: 0.75rem 1.5rem;
          border: 2px solid transparent;
          border-radius: 0.5rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          flex: 1;
        }

        .btn-primary {
          background: #66bb6a;
          color: white;
        }

        .btn-primary:hover {
          background: #43a047;
          transform: translateY(-2px);
        }

        .btn-secondary {
          background: #f5f5f5;
          color: #333;
          border-color: #e0e0e0;
        }

        .btn-secondary:hover {
          background: #e0e0e0;
        }

        @media (max-width: 768px) {
          .editor-header {
            padding: 1.5rem;
          }

          .editor-toolbar {
            flex-direction: column;
          }

          .filter-buttons {
            overflow-x: auto;
            padding-bottom: 0.5rem;
          }

          .editor-form {
            padding: 1.5rem;
          }

          .note-editor.mobile .notes-list {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default NoteEditor;
