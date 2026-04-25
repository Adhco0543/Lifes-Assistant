'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useAppIntegration, useResponsive } from '../lib/hooks';

export interface FieldValidation {
  isValid: boolean;
  message: string;
  suggestions: string[];
}

interface RealtimeFeedbackProps {
  userId?: string;
  formName?: string;
  onFormChange?: (data: Record<string, string>) => void;
  fields: {
    name: string;
    label: string;
    type?: string;
    placeholder?: string;
  }[];
}

export const RealtimeFeedback: React.FC<RealtimeFeedbackProps> = ({
  userId = 'guest',
  formName = 'realtime-form',
  onFormChange,
  fields,
}) => {
  const { isMobile, isTablet } = useResponsive();
  const integration = useAppIntegration(userId);
  
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, FieldValidation>>({});
  const [suggestedText, setSuggestedText] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);

  /**
   * Validate field in real-time
   */
  const validateField = useCallback(
    (fieldName: string, value: string): FieldValidation => {
      let isValid = true;
      let message = '';
      let suggestions: string[] = [];

      if (!value.trim()) {
        isValid = false;
        message = 'This field is required';
        suggestions = [];
      } else if (fieldName.toLowerCase().includes('email')) {
        isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        message = isValid ? '✓ Valid email' : '✗ Invalid email format';
        suggestions = isValid
          ? []
          : ['Please enter a valid email address (e.g., user@example.com)'];
      } else if (fieldName.toLowerCase().includes('phone')) {
        isValid = /^\d{10,}$/.test(value.replace(/\D/g, ''));
        message = isValid ? '✓ Valid phone number' : '✗ Invalid phone format';
        suggestions = isValid
          ? []
          : ['Please enter a valid phone number'];
      } else if (fieldName.toLowerCase().includes('name')) {
        isValid = value.trim().length >= 2;
        message = isValid ? '✓ Valid name' : '✗ Name too short';
        suggestions = isValid
          ? []
          : ['Enter at least 2 characters'];
      } else {
        message = '✓ Valid input';
      }

      return { isValid, message, suggestions };
    },
    []
  );

  /**
   * Generate smart suggestions
   */
  const generateSuggestions = useCallback(
    (fieldName: string, value: string): string => {
      if (!value.trim()) return '';

      // Example: auto-complete suggestions based on field type
      if (fieldName.toLowerCase().includes('name')) {
        if (value.length <= 2) {
          return value;
        }
        // Could call an API for name suggestions
        return value;
      }

      if (fieldName.toLowerCase().includes('company')) {
        // Could integrate with company database
        return value;
      }

      return value;
    },
    []
  );

  /**
   * Handle field change with real-time feedback
   */
  const handleFieldChange = (fieldName: string, value: string) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));

    // Validate field
    const validation = validateField(fieldName, value);
    setFeedback((prev) => ({ ...prev, [fieldName]: validation }));

    // Generate suggestion
    const suggestion = generateSuggestions(fieldName, value);
    setSuggestedText((prev) => ({ ...prev, [fieldName]: suggestion }));

    // Track in analytics
    integration.analytics.trackFormInteraction(formName, 'input', {
      fieldName,
      valueLength: value.length,
      isValid: validation.isValid,
    });

    // Notify parent
    if (onFormChange) {
      onFormChange({ ...formData, [fieldName]: value });
    }
  };

  /**
   * Apply suggestion
   */
  const applySuggestion = (fieldName: string) => {
    const suggestion = suggestedText[fieldName];
    if (suggestion) {
      handleFieldChange(fieldName, suggestion);
      integration.trackUserAction('suggestion_applied', 'form', {
        fieldName,
      });
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(() => {
    const allValid = Object.values(feedback).every(f => f.isValid !== false);
    
    integration.trackFormSubmission(formName, formData, allValid);

    if (allValid) {
      integration.analytics.trackEvent('form_complete', 'form', {
        formName,
        fieldCount: Object.keys(formData).length,
      });
    }
  }, [feedback, formData, formName, integration]);

  // Track form start
  useEffect(() => {
    integration.analytics.trackFormInteraction(formName, 'start', {
      fieldCount: fields.length,
    });
  }, [formName, fields.length, integration]);

  return (
    <div className={`realtime-feedback-form ${isMobile ? 'mobile' : ''} ${isTablet ? 'tablet' : ''}`}>
      {fields.map((field) => (
        <div key={field.name} className="form-field-group">
          <label htmlFor={field.name} className="field-label">
            {field.label}
          </label>

          <div className="input-wrapper">
            <input
              id={field.name}
              type={field.type || 'text'}
              placeholder={field.placeholder}
              value={formData[field.name] || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              onFocus={() => setFocusedField(field.name)}
              onBlur={() => setFocusedField(null)}
              className={`form-input ${
                feedback[field.name]?.isValid === false ? 'invalid' : ''
              } ${feedback[field.name]?.isValid === true ? 'valid' : ''}`}
            />

            {suggestedText[field.name] &&
              suggestedText[field.name] !== formData[field.name] &&
              focusedField !== field.name && (
                <button
                  className="suggestion-button"
                  onClick={() => applySuggestion(field.name)}
                  type="button"
                >
                  💡 {isMobile ? 'Suggest' : suggestedText[field.name]}
                </button>
              )}
          </div>

          {feedback[field.name] && (
            <div className="feedback-container">
              <span
                className={`feedback-message ${
                  feedback[field.name].isValid ? 'success' : 'error'
                }`}
              >
                {feedback[field.name].message}
              </span>

              {feedback[field.name].suggestions.length > 0 && (
                <ul className="suggestions-list">
                  {feedback[field.name].suggestions.map((suggestion, idx) => (
                    <li key={idx} className="suggestion-item">
                      📌 {suggestion}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      ))}

      <style jsx>{`
        .realtime-feedback-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .realtime-feedback-form.mobile {
          gap: 1rem;
        }

        .form-field-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .field-label {
          font-weight: 500;
          font-size: 0.95rem;
          color: #333;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .form-input {
          flex: 1;
          min-width: 200px;
          padding: 0.75rem;
          border: 2px solid #e0e0e0;
          border-radius: 0.5rem;
          font-size: 1rem;
          transition: all 0.3s ease;
          font-family: inherit;
        }

        .form-input:focus {
          outline: none;
          border-color: #4171ff;
          box-shadow: 0 0 0 3px rgba(65, 113, 255, 0.1);
        }

        .form-input.valid {
          border-color: #2ea043;
          background-color: #f0fdf4;
        }

        .form-input.invalid {
          border-color: #d32f2f;
          background-color: #fdf0f0;
        }

        .suggestion-button {
          padding: 0.75rem 1rem;
          background-color: #fff8e1;
          border: 1px solid #fbc02d;
          border-radius: 0.5rem;
          cursor: pointer;
          font-size: 0.9rem;
          white-space: nowrap;
          transition: all 0.2s ease;
          font-weight: 500;
        }

        .suggestion-button:hover {
          background-color: #fbc02d;
          color: white;
        }

        .feedback-container {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .feedback-message {
          font-size: 0.85rem;
          font-weight: 500;
        }

        .feedback-message.success {
          color: #2ea043;
        }

        .feedback-message.error {
          color: #d32f2f;
        }

        .suggestions-list {
          list-style: none;
          padding: 0;
          margin: 0;
          background-color: #f5f5f5;
          border-left: 3px solid #fbc02d;
          padding-left: 1rem;
          padding-top: 0.5rem;
          padding-bottom: 0.5rem;
          border-radius: 0.25rem;
        }

        .suggestion-item {
          font-size: 0.85rem;
          color: #666;
          margin: 0.25rem 0;
        }

        @media (max-width: 640px) {
          .realtime-feedback-form {
            gap: 1rem;
          }

          .form-input {
            min-width: 100%;
            font-size: 16px;
          }

          .input-wrapper {
            flex-direction: column;
          }

          .suggestion-button {
            width: 100%;
            text-align: center;
          }

          .field-label {
            font-size: 0.9rem;
          }
        }

        @media (max-width: 768px) {
          .form-input {
            padding: 0.875rem;
          }

          .suggestion-button {
            padding: 0.675rem 0.9rem;
            font-size: 0.85rem;
          }
        }
      `}</style>
    </div>
  );
};
