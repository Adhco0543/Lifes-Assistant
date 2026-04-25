'use client';

import React, { useState, useEffect } from 'react';
import { workspaceManager } from '../lib/workspaceManager';
import { RichMedia } from './Richmedia';

interface AuditLogViewerProps {
  workspaceId: string;
  userId: string;
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({
  workspaceId,
  userId,
}) => {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'user' | 'workspace' | 'quote' | 'note'>('all');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Load audit logs
  useEffect(() => {
    try {
      const logs = workspaceManager.getAuditLog(workspaceId, 200);
      setAuditLogs(logs);
      setFilteredLogs(logs);
    } catch (error) {
      console.error('Error loading audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  // Apply filters
  useEffect(() => {
    let filtered = auditLogs;

    if (filterType !== 'all') {
      filtered = filtered.filter((log) => log.resourceType === filterType);
    }

    if (selectedUser) {
      filtered = filtered.filter((log) => log.userId === selectedUser);
    }

    if (searchQuery) {
      filtered = filtered.filter((log) =>
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.resourceId.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredLogs(filtered);
  }, [filterType, selectedUser, searchQuery, auditLogs]);

  const getActionColor = (action: string) => {
    if (action.includes('created')) return '#4CAF50';
    if (action.includes('updated') || action.includes('edited')) return '#FFC107';
    if (action.includes('deleted') || action.includes('removed')) return '#F44336';
    if (action.includes('added')) return '#2196F3';
    return '#666';
  };

  const getActionIcon = (action: string): 'checkmark' | 'arrow' | 'alert' | 'star' => {
    const iconMap: Record<string, 'checkmark' | 'arrow' | 'alert' | 'star'> = {
      'created': 'checkmark',
      'updated': 'arrow',
      'deleted': 'alert',
      'added': 'star',
    };
    return iconMap[action.split('_')[0]] || 'arrow';
  };

  const uniqueUsers = Array.from(
    new Set(auditLogs.map((log) => log.userId))
  );

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading audit logs...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>
          <RichMedia icon="alert" size="md" /> Activity Audit Log
        </h2>
        <p>{filteredLogs.length} of {auditLogs.length} activities</p>
      </div>

      <div style={styles.filterSection}>
        <div style={styles.filterGroup}>
          <label htmlFor="audit-search">Search</label>
          <input
            id="audit-search"
            name="audit-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by action or resource..."
            style={styles.searchInput}
          />
        </div>

        <div style={styles.filterGroup}>
          <label htmlFor="activity-type">Activity Type</label>
          <select
            id="activity-type"
            name="activity-type"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            style={styles.select}
          >
            <option value="all">All Types</option>
            <option value="workspace">Workspace</option>
            <option value="user">User</option>
            <option value="quote">Quote</option>
            <option value="note">Note</option>
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label htmlFor="selected-user">User</label>
          <select
            id="selected-user"
            name="selected-user"
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            style={styles.select}
          >
            <option value="">All Users</option>
            {uniqueUsers.map((uid) => (
              <option key={uid} value={uid}>
                {uid} {uid === userId ? '(You)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={styles.logsList}>
        {filteredLogs.length === 0 ? (
          <div style={styles.emptyState}>
            <p>No activities found matching your filters</p>
          </div>
        ) : (
          <div>
            {filteredLogs.map((log, idx) => (
              <div key={idx} style={styles.logEntry}>
                <div style={styles.logIcon}>
                  <div
                    style={{
                      ...styles.iconBg,
                      backgroundColor: getActionColor(log.action),
                    }}
                  >
                    <RichMedia icon={getActionIcon(log.action)} size="sm" />
                  </div>
                </div>

                <div style={styles.logContent}>
                  <div style={styles.logHeader}>
                    <h4 style={{ margin: 0 }}>
                      {log.action.replace(/_/g, ' ').toUpperCase()}
                    </h4>
                    <span style={styles.timestamp}>
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <div style={styles.logDetails}>
                    <p>
                      <strong>User:</strong> {log.userId}
                      {log.userId === userId ? ' (You)' : ''}
                    </p>
                    <p>
                      <strong>Type:</strong> {log.resourceType}
                    </p>
                    <p>
                      <strong>Resource ID:</strong>{' '}
                      <code>{log.resourceId.slice(0, 20)}...</code>
                    </p>

                    {Object.keys(log.changes).length > 0 && (
                      <div style={styles.changes}>
                        <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                          Changes:
                        </p>
                        {Object.entries(log.changes).map(
                          ([key, value]: [string, any]) => (
                            <div key={key} style={styles.change}>
                              <strong>{key}:</strong>
                              <br />
                              <span style={styles.oldValue}>
                                Before: {JSON.stringify(value.before)}
                              </span>
                              <br />
                              <span style={styles.newValue}>
                                After: {JSON.stringify(value.after)}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        ${getStyles()}
      `}</style>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '0.75rem',
  },
  header: {
    marginBottom: '2rem',
  },
  loading: {
    textAlign: 'center' as const,
    padding: '2rem',
    color: '#666',
  },
  filterSection: {
    display: 'grid' as const,
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '0.75rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  filterGroup: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  searchInput: {
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '0.5rem',
    fontSize: '1rem',
  },
  select: {
    padding: '0.75rem',
    border: '1px solid #ddd',
    borderRadius: '0.5rem',
    fontSize: '1rem',
  },
  logsList: {
    backgroundColor: 'white',
    borderRadius: '0.75rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '3rem 2rem',
    color: '#999',
  },
  logEntry: {
    display: 'flex' as const,
    borderBottom: '1px solid #f0f0f0',
    padding: '1.5rem',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#fafafa',
    },
  },
  logIcon: {
    marginRight: '1rem',
  },
  iconBg: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    color: 'white',
  },
  logContent: {
    flex: 1,
  },
  logHeader: {
    display: 'flex' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: '0.75rem',
  },
  timestamp: {
    fontSize: '0.85rem',
    color: '#999',
  },
  logDetails: {
    fontSize: '0.9rem',
    color: '#666',
  },
  changes: {
    marginTop: '1rem',
    padding: '1rem',
    backgroundColor: '#f9f9f9',
    borderRadius: '0.5rem',
    borderLeft: '3px solid #FFC107',
  },
  change: {
    marginBottom: '0.75rem',
    fontSize: '0.85rem',
  },
  oldValue: {
    color: '#F44336',
  },
  newValue: {
    color: '#4CAF50',
  },
};

function getStyles() {
  return `
    h2 { display: flex; align-items: center; gap: 0.75rem; margin: 0 0 0.5rem 0; }
    h4 { margin: 0; }
    label { font-weight: bold; color: #333; }
    p { margin: 0.35rem 0; }
    code { background: #f5f5f5; padding: 0.2rem 0.4rem; border-radius: 0.25rem; }
  `;
}
