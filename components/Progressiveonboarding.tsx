'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { RichMedia } from './Richmedia';
import { useAppIntegration, useResponsive } from '../lib/hooks';

export interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  question: string;
  type: 'text' | 'select' | 'radio' | 'checkbox';
  options?: string[];
  placeholder?: string;
  icon?: string;
}

interface ProgressiveOnboardingProps {
  userId?: string;
  onComplete?: (data: Record<string, any>) => void;
  onStepChange?: (step: number) => void;
}

const DEFAULT_STEPS: OnboardingStep[] = [
  {
    id: 1,
    title: 'Welcome',
    description: 'Let\'s get to know your business',
    question: 'What is your business name?',
    type: 'text',
    placeholder: 'Enter your business name',
    icon: 'smile',
  },
  {
    id: 2,
    title: 'Business Type',
    description: 'Help us understand what you do',
    question: 'What type of business are you in?',
    type: 'select',
    options: [
      'Retail',
      'Service',
      'Food & Beverage',
      'Professional Services',
      'E-commerce',
      'Other',
    ],
    icon: 'briefcase',
  },
  {
    id: 3,
    title: 'Location',
    description: 'Where do you operate?',
    question: 'What is your primary location?',
    type: 'text',
    placeholder: 'City, State',
    icon: 'map',
  },
  {
    id: 4,
    title: 'Team Size',
    description: 'How many people work with you?',
    question: 'What is your team size?',
    type: 'select',
    options: ['Solo', '2-5', '6-10', '11-20', '20+'],
    icon: 'users',
  },
  {
    id: 5,
    title: 'Goals',
    description: 'What are your main objectives?',
    question: 'What are your primary goals? (Select all that apply)',
    type: 'checkbox',
    options: [
      'Increase Revenue',
      'Improve Customer Experience',
      'Streamline Operations',
      'Build Brand Presence',
    ],
    icon: 'target',
  },
  {
    id: 6,
    title: 'Budget',
    description: 'What\'s your investment range?',
    question: 'What is your monthly budget for tools?',
    type: 'radio',
    options: ['Under $100', '$100-$500', '$500-$1000', '$1000+'],
    icon: 'dollar',
  },
  {
    id: 7,
    title: 'Preferences',
    description: 'Final touches to personalize your experience',
    question: 'How would you like to be contacted?',
    type: 'radio',
    options: ['Email', 'Phone', 'SMS', 'In-app Notifications'],
    icon: 'bell',
  },
];

export const ProgressiveOnboarding: React.FC<ProgressiveOnboardingProps> = ({
  userId = 'guest',
  onComplete,
  onStepChange,
}) => {
  const { isMobile, isTablet } = useResponsive();
  const integration = useAppIntegration(userId);
  
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [isComplete, setIsComplete] = useState(false);
  const [animatingOut, setAnimatingOut] = useState(false);

  const steps = DEFAULT_STEPS;
  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  // Auto-complete after showing message
  useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(() => {
        onComplete?.({
          timestamp: Date.now(),
          responses,
          completedSteps: steps.length,
        });
      }, 2000); // Show completion message for 2 seconds

      return () => clearTimeout(timer);
    }
  }, [isComplete, onComplete, responses, steps.length]);

  /**
   * Handle response to current question
   */
  const handleResponse = useCallback(
    (value: string | string[]) => {
      setResponses((prev) => ({
        ...prev,
        [step.id]: value,
      }));
    },
    [step.id]
  );

  /**
   * Move to next step
   */
  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      // Track step completion
      integration.trackUserAction(`step_${currentStep + 1}_complete`, 'onboarding', {
        stepTitle: step.title,
        hasResponse: !!responses[step.id],
      });

      setAnimatingOut(true);
      setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
        setAnimatingOut(false);
        onStepChange?.(currentStep + 2);
      }, 300);
    } else {
      setIsComplete(true);
      const onboardingData = {
        timestamp: Date.now(),
        responses,
        completedSteps: steps.length,
      };
      
      integration.trackUserAction('onboarding_complete', 'onboarding', onboardingData);
      integration.personalization.recordInteraction('onboarding_completed', {
        section: 'onboarding',
        timeSpent: 0,
      });
    }
  }, [currentStep, steps.length, responses, step, integration, onStepChange]);

  /**
   * Move to previous step
   */
  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      integration.trackUserAction('step_back', 'onboarding', {
        fromStep: currentStep + 1,
        toStep: currentStep,
      });
      
      setAnimatingOut(true);
      setTimeout(() => {
        setCurrentStep((prev) => prev - 1);
        setAnimatingOut(false);
        onStepChange?.(currentStep);
      }, 300);
    }
  }, [currentStep, onStepChange, integration]);

  /**
   * Skip step
   */
  const handleSkip = useCallback(() => {
    integration.trackUserAction('step_skipped', 'onboarding', {
      step: currentStep + 1,
      stepTitle: step.title,
    });
    handleNext();
  }, [handleNext, currentStep, step, integration]);

  if (isComplete) {
    return (
      <div className="onboarding-complete">
        <RichMedia type="animation" animation="pulse" size="xl" color="#2ea043" />
        <h2>Welcome to the family! 🎉</h2>
        <p>Your business profile is all set up. Let's get started!</p>
        <p style={{ fontSize: '14px', color: '#999', marginTop: '20px' }}>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className={`progressive-onboarding ${isMobile ? 'mobile' : ''} ${isTablet ? 'tablet' : ''}`} data-testid="progressive-onboarding">
      {/* Header */}
      <div className="onboarding-header">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className="step-counter">
          Step {currentStep + 1} of {steps.length}
        </div>
      </div>

      {/* Content */}
      <div
        className={`onboarding-content ${animatingOut ? 'fade-out' : 'fade-in'}`}
      >
        <div className="step-icon">
          <RichMedia
            type="visual"
            size="lg"
            color={`hsl(${(currentStep * 360) / steps.length}, 70%, 60%)`}
          />
        </div>

        <h1 className="step-title">{step.title}</h1>
        <p className="step-description">{step.description}</p>

        <div className="question-container">
          <label className="question">{step.question}</label>

          {/* Text Input */}
          {step.type === 'text' && (
            <input
              type="text"
              placeholder={step.placeholder}
              value={responses[step.id] || ''}
              onChange={(e) => handleResponse(e.target.value)}
              className="form-input text-input"
              autoFocus
            />
          )}

          {/* Select Dropdown */}
          {step.type === 'select' && (
            <select
              value={responses[step.id] || ''}
              onChange={(e) => handleResponse(e.target.value)}
              className="form-input select-input"
            >
              <option value="">Select an option...</option>
              {step.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          )}

          {/* Radio Buttons */}
          {step.type === 'radio' && (
            <div className="radio-group">
              {step.options?.map((option) => (
                <label key={option} className="radio-item">
                  <input
                    type="radio"
                    name={`step-${step.id}`}
                    value={option}
                    checked={responses[step.id] === option}
                    onChange={(e) => handleResponse(e.target.value)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          )}

          {/* Checkboxes */}
          {step.type === 'checkbox' && (
            <div className="checkbox-group">
              {step.options?.map((option) => (
                <label key={option} className="checkbox-item">
                  <input
                    type="checkbox"
                    value={option}
                    checked={(responses[step.id] || []).includes(option)}
                    onChange={(e) => {
                      const current = responses[step.id] || [];
                      const updated = e.target.checked
                        ? [...current, option]
                        : current.filter((v: string) => v !== option);
                      handleResponse(updated);
                    }}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="onboarding-footer">
        <button
          className="btn-secondary"
          onClick={handleBack}
          disabled={currentStep === 0}
        >
          ← Back
        </button>

        <button className="btn-tertiary" onClick={handleSkip}>
          Skip
        </button>

        <button
          className="btn-primary"
          onClick={handleNext}
          disabled={!responses[step.id]}
        >
          {currentStep === steps.length - 1 ? 'Complete' : 'Next →'}
        </button>
      </div>

      <style jsx>{`
        .progressive-onboarding {
          max-width: 600px;
          margin: 0 auto;
          padding: 2rem;
          background: linear-gradient(135deg, #ffffff 0%, #f5f7fa 100%);
          border-radius: 1.5rem;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
          animation: slideUp 0.5s ease-out;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .onboarding-header {
          margin-bottom: 2rem;
        }

        .progress-bar {
          width: 100%;
          height: 4px;
          background-color: #e0e0e0;
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 1rem;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #4171ff, #00d4ff);
          transition: width 0.5s ease;
          border-radius: 2px;
        }

        .step-counter {
          text-align: right;
          font-size: 0.85rem;
          color: #999;
          font-weight: 500;
        }

        .onboarding-content {
          margin: 2rem 0;
          text-align: center;
          animation-duration: 0.3s;
          animation-timing-function: ease-out;
        }

        .onboarding-content.fade-in {
          animation-name: fadeIn;
        }

        .onboarding-content.fade-out {
          animation-name: fadeOut;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeOut {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-10px);
          }
        }

        .step-icon {
          margin-bottom: 1.5rem;
          display: flex;
          justify-content: center;
        }

        .step-title {
          font-size: 1.8rem;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 0.5rem;
        }

        .step-description {
          font-size: 1rem;
          color: #666;
          margin-bottom: 2rem;
        }

        .question-container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          text-align: left;
          margin: 2rem 0;
        }

        .question {
          font-weight: 600;
          color: #333;
          font-size: 1.05rem;
        }

        .form-input {
          padding: 0.75rem;
          border: 2px solid #e0e0e0;
          border-radius: 0.5rem;
          font-size: 1rem;
          font-family: inherit;
          transition: all 0.2s ease;
        }

        .form-input:focus {
          outline: none;
          border-color: #4171ff;
          box-shadow: 0 0 0 3px rgba(65, 113, 255, 0.1);
        }

        .text-input {
          padding: 0.875rem;
        }

        .select-input {
          cursor: pointer;
        }

        .radio-group,
        .checkbox-group {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .radio-item,
        .checkbox-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          border: 2px solid #e0e0e0;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s ease;
          font-weight: 500;
        }

        .radio-item:hover,
        .checkbox-item:hover {
          background-color: #f5f5f5;
          border-color: #4171ff;
        }

        .radio-item input,
        .checkbox-item input {
          cursor: pointer;
          width: 18px;
          height: 18px;
          accent-color: #4171ff;
        }

        .onboarding-footer {
          display: flex;
          gap: 1rem;
          justify-content: space-between;
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid #e0e0e0;
        }

        button {
          flex: 1;
          padding: 0.875rem 1.5rem;
          border: none;
          border-radius: 0.5rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-primary {
          background: linear-gradient(135deg, #4171ff 0%, #00d4ff 100%);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(65, 113, 255, 0.4);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background-color: #f0f0f0;
          color: #333;
        }

        .btn-secondary:hover:not(:disabled) {
          background-color: #e0e0e0;
        }

        .btn-secondary:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .btn-tertiary {
          background-color: transparent;
          color: #999;
          border: 1px solid #e0e0e0;
        }

        .btn-tertiary:hover {
          color: #666;
          border-color: #ccc;
        }

        .onboarding-complete {
          text-align: center;
          padding: 2rem;
        }

        .onboarding-complete h2 {
          font-size: 1.8rem;
          margin: 1.5rem 0 0.5rem;
          color: #1a1a1a;
        }

        .onboarding-complete p {
          color: #666;
          margin-bottom: 2rem;
        }

        /* Mobile-first responsive design */
        @media (max-width: 640px) {
          .progressive-onboarding {
            max-width: 100%;
            margin: 0;
            padding: 1rem;
            border-radius: 0;
          }

          .step-icon {
            margin-bottom: 1rem;
          }

          .step-title {
            font-size: 1.4rem;
          }

          .step-description {
            font-size: 0.9rem;
          }

          .onboarding-footer {
            flex-direction: column;
            gap: 0.5rem;
          }

          button {
            padding: 1rem;
            font-size: 0.95rem;
          }

          .question-container {
            margin: 1.5rem 0;
          }

          .form-input,
          .select-input {
            padding: 0.875rem;
            font-size: 16px;
          }

          .radio-item,
          .checkbox-item {
            padding: 0.875rem;
          }

          .onboarding-complete {
            padding: 1.5rem;
          }

          .onboarding-complete h2 {
            font-size: 1.3rem;
            margin: 1rem 0 0.5rem;
          }
        }

        @media (max-width: 768px) {
          .progressive-onboarding.tablet {
            padding: 1.5rem;
          }

          button {
            padding: 0.875rem 1.25rem;
            font-size: 0.95rem;
          }

          .question-container {
            margin: 1.5rem 0;
          }
        }

        @media (max-width: 1024px) {
          .progressive-onboarding {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default ProgressiveOnboarding;
