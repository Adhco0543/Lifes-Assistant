'use client';

import React, { useState } from 'react';
import { MinimizablePanel } from './MinimizablePanel';

interface ToolRecommendation {
  name: string;
  icon: string;
  description: string;
  category: string;
}

interface SafetyEquipment {
  name: string;
  icon: string;
  description: string;
}

const BUSINESS_TYPE_TOOLS: Record<string, ToolRecommendation[]> = {
  'Retail': [
    { name: 'POS System', icon: '🛒', description: 'Manage sales and inventory', category: 'Operations' },
    { name: 'Customer Database', icon: '👥', description: 'Track customer interactions', category: 'CRM' },
    { name: 'Inventory Manager', icon: '📦', description: 'Stock tracking and alerts', category: 'Inventory' },
    { name: 'Sales Analytics', icon: '📊', description: 'Monitor performance metrics', category: 'Analytics' },
  ],
  'Service': [
    { name: 'Scheduling System', icon: '📅', description: 'Appointment management', category: 'Operations' },
    { name: 'Work Orders', icon: '🎯', description: 'Assign and track jobs', category: 'Workflow' },
    { name: 'Time Tracking', icon: '⏱️', description: 'Monitor billable hours', category: 'Billing' },
    { name: 'Service Reports', icon: '📋', description: 'Generate professional reports', category: 'Documentation' },
  ],
  'Food & Beverage': [
    { name: 'Recipe Manager', icon: '👨‍🍳', description: 'Maintain recipes and costs', category: 'Operations' },
    { name: 'Inventory Control', icon: '🥘', description: 'Track ingredients and waste', category: 'Inventory' },
    { name: 'Supplier Management', icon: '🚚', description: 'Manage vendor relationships', category: 'Purchasing' },
    { name: 'Menu Optimizer', icon: '🍕', description: 'Analyze menu profitability', category: 'Analytics' },
  ],
  'Professional Services': [
    { name: 'Project Management', icon: '📂', description: 'Organize client projects', category: 'Management' },
    { name: 'Time Tracking', icon: '⏱️', description: 'Precise billing hours', category: 'Billing' },
    { name: 'Document Management', icon: '📄', description: 'Secure file storage', category: 'Documentation' },
    { name: 'Client Portal', icon: '🔐', description: 'Share deliverables securely', category: 'Communication' },
  ],
  'E-commerce': [
    { name: 'Product Catalog', icon: '🛍️', description: 'Manage product listings', category: 'Catalog' },
    { name: 'Payment Gateway', icon: '💳', description: 'Process online payments', category: 'Payments' },
    { name: 'Shipping Integration', icon: '📦', description: 'Print labels and track', category: 'Logistics' },
    { name: 'Email Marketing', icon: '📧', description: 'Customer campaigns', category: 'Marketing' },
  ],
};

const SAFETY_EQUIPMENT: Record<string, SafetyEquipment[]> = {
  'Retail': [
    { name: 'Fire Extinguisher', icon: '🧯', description: 'Class A, B, C rated' },
    { name: 'First Aid Kit', icon: '🩹', description: 'OSHA compliant' },
    { name: 'Emergency Exit Signs', icon: '🚪', description: 'Illuminated and clear' },
    { name: 'Slip Prevention Mats', icon: '🛡️', description: 'High-traffic areas' },
  ],
  'Service': [
    { name: 'Hard Hat', icon: '👷', description: 'For on-site work' },
    { name: 'Safety Vest', icon: '🦺', description: 'High visibility' },
    { name: 'Safety Glasses', icon: '🥽', description: 'ANSI Z87.1 certified' },
    { name: 'Work Gloves', icon: '🧤', description: 'Cut and puncture resistant' },
  ],
  'Food & Beverage': [
    { name: 'Food Handler Certification', icon: '📋', description: 'Required for staff' },
    { name: 'Non-Slip Floor Mats', icon: '🛡️', description: 'Kitchen areas' },
    { name: 'Fire Suppression System', icon: '🧯', description: 'For cooking equipment' },
    { name: 'Thermometer', icon: '🌡️', description: 'Monitor food temperatures' },
  ],
  'Professional Services': [
    { name: 'Ergonomic Chair', icon: '💺', description: 'Reduce back strain' },
    { name: 'Monitor Stand', icon: '🖥️', description: 'Eye level positioning' },
    { name: 'Keyboard & Mouse', icon: '⌨️', description: 'Ergonomic design' },
    { name: 'Anti-fatigue Mat', icon: '🛡️', description: 'Standing desk areas' },
  ],
  'E-commerce': [
    { name: 'Ergonomic Packing Station', icon: '📦', description: 'Reduce repetitive strain' },
    { name: 'Anti-fatigue Mats', icon: '🛡️', description: 'Standing areas' },
    { name: 'First Aid Kit', icon: '🩹', description: 'Handling injuries' },
    { name: 'PPE Supplies', icon: '🧤', description: 'Gloves and protective wear' },
  ],
};

interface BusinessRecommendationsProps {
  businessType: string;
}

export const BusinessRecommendations: React.FC<BusinessRecommendationsProps> = ({ businessType }) => {
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [selectedSafety, setSelectedSafety] = useState<Set<string>>(new Set());
  
  const tools = BUSINESS_TYPE_TOOLS[businessType] || BUSINESS_TYPE_TOOLS['Retail'];
  const safety = SAFETY_EQUIPMENT[businessType] || SAFETY_EQUIPMENT['Retail'];
  
  const handleToolClick = (toolName: string) => {
    const newSelected = new Set(selectedTools);
    if (newSelected.has(toolName)) {
      newSelected.delete(toolName);
    } else {
      newSelected.add(toolName);
    }
    setSelectedTools(newSelected);
  };
  
  const handleSafetyClick = (safetyName: string) => {
    const newSelected = new Set(selectedSafety);
    if (newSelected.has(safetyName)) {
      newSelected.delete(safetyName);
    } else {
      newSelected.add(safetyName);
    }
    setSelectedSafety(newSelected);
  };

  return (
    <div style={{ padding: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '2rem' }}>
      {/* Recommended Tools */}
      <MinimizablePanel title={`Recommended Tools for ${businessType}`} icon="🔧">
        <div style={{ display: 'grid', gap: '1rem' }}>
          {tools.map((tool, idx) => (
            <div
              key={idx}
              onClick={() => handleToolClick(tool.name)}
              style={{
                background: selectedTools.has(tool.name) ? '#dbeafe' : 'white',
                border: selectedTools.has(tool.name) ? '2px solid #3b82f6' : '2px solid #e5e7eb',
                borderRadius: '0.75rem',
                padding: '1.25rem',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#10b981';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.1)';
                e.currentTarget.style.transform = 'translateX(4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = selectedTools.has(tool.name) ? '#3b82f6' : '#e5e7eb';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ fontSize: '1.5rem' }}>{tool.icon}</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>{tool.name}</h3>
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>{tool.description}</p>
                  <span style={{ display: 'inline-block', marginTop: '0.5rem', padding: '0.25rem 0.75rem', background: '#e0f2fe', color: '#0369a1', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: '600' }}>
                    {tool.category}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </MinimizablePanel>

      {/* Safety Equipment */}
      <MinimizablePanel title={`Safety Equipment for ${businessType}`} icon="🛡️">
        <div style={{ display: 'grid', gap: '1rem' }}>
          {safety.map((item, idx) => (
            <div
              key={idx}
              onClick={() => handleSafetyClick(item.name)}
              style={{
                background: selectedSafety.has(item.name) ? '#fee2e2' : 'white',
                border: selectedSafety.has(item.name) ? '2px solid #dc2626' : '2px solid #fecaca',
                borderRadius: '0.75rem',
                padding: '1.25rem',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#dc2626';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.1)';
                e.currentTarget.style.transform = 'translateX(4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = selectedSafety.has(item.name) ? '#dc2626' : '#fecaca';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ fontSize: '1.5rem' }}>{item.icon}</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#1f2937' }}>{item.name}</h3>
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>{item.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </MinimizablePanel>
    </div>
  );
};
