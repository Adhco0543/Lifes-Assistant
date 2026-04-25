'use client';

import React, { useState, useEffect } from 'react';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: 'online' | 'away' | 'offline';
  lastSeen?: string;
}

interface ChatMessage {
  id: string;
  author: string;
  message: string;
  timestamp: number;
  avatar?: string;
}

interface TeamWorkspaceProps {
  userId: string;
  businessName?: string;
}

export const TeamWorkspace: React.FC<TeamWorkspaceProps> = ({ userId, businessName }) => {
  const [activeTab, setActiveTab] = useState<'team' | 'chat' | 'projects'>('team');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      author: 'System',
      message: 'Welcome to Team Workspace! Start collaborating with your team.',
      timestamp: Date.now(),
    },
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [teamMembers] = useState<TeamMember[]>([
    { id: '1', name: 'You', role: 'Owner', status: 'online' },
    { id: '2', name: 'Team Member 1', role: 'Admin', status: 'online' },
    { id: '3', name: 'Team Member 2', role: 'Contributor', status: 'away' },
  ]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      author: 'You',
      message: newMessage,
      timestamp: Date.now(),
    };

    setMessages([...messages, message]);
    setNewMessage('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return '#10b981';
      case 'away':
        return '#f59e0b';
      case 'offline':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '2rem' }}>Team Workspace</h1>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '2px solid #e5e7eb' }}>
        <button
          onClick={() => setActiveTab('team')}
          style={{
            padding: '1rem 1.5rem',
            background: activeTab === 'team' ? '#3b82f6' : 'transparent',
            color: activeTab === 'team' ? 'white' : '#6b7280',
            border: 'none',
            borderBottom: activeTab === 'team' ? '3px solid #1d4ed8' : 'none',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '600',
          }}
        >
          👥 Team Members
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          style={{
            padding: '1rem 1.5rem',
            background: activeTab === 'chat' ? '#3b82f6' : 'transparent',
            color: activeTab === 'chat' ? 'white' : '#6b7280',
            border: 'none',
            borderBottom: activeTab === 'chat' ? '3px solid #1d4ed8' : 'none',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '600',
          }}
        >
          💬 Team Chat
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          style={{
            padding: '1rem 1.5rem',
            background: activeTab === 'projects' ? '#3b82f6' : 'transparent',
            color: activeTab === 'projects' ? 'white' : '#6b7280',
            border: 'none',
            borderBottom: activeTab === 'projects' ? '3px solid #1d4ed8' : 'none',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '600',
          }}
        >
          📊 Projects
        </button>
      </div>

      {activeTab === 'team' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
          {teamMembers.map((member) => (
            <div
              key={member.id}
              style={{
                background: 'white',
                border: '2px solid #e5e7eb',
                borderRadius: '1rem',
                padding: '1.5rem',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div
                  style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    background: '#e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                  }}
                >
                  {member.name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>{member.name}</h3>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>{member.role}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: getStatusColor(member.status),
                  }}
                />
                <span style={{ fontSize: '0.875rem', color: '#6b7280', textTransform: 'capitalize' }}>{member.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'chat' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '500px', border: '2px solid #e5e7eb', borderRadius: '1rem', background: '#f9fafb' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: msg.author === 'You' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    background: msg.author === 'You' ? '#3b82f6' : '#e5e7eb',
                    color: msg.author === 'You' ? 'white' : '#1f2937',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.75rem',
                    maxWidth: '70%',
                    fontSize: '0.95rem',
                  }}
                >
                  {msg.author !== 'You' && <strong>{msg.author}: </strong>}
                  {msg.message}
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '1rem', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '0.95rem',
              }}
            />
            <button
              onClick={handleSendMessage}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {activeTab === 'projects' && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#1f2937' }}>Projects Coming Soon</h3>
          <p>Collaborate on projects with your team. Track progress and share updates.</p>
        </div>
      )}
    </div>
  );
};
