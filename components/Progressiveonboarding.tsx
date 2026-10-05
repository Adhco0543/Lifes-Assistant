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
        // Format data for the callback with proper structure
        const completionData = {
          timestamp: Date.now(),
          responses,
          completedSteps: steps.length,
          // Extract key fields for business profile
          businessName: responses[1] || 'My Business',
          businessType: responses[2] || 'other',
          email: responses.email || 'owner@business.local',
        };
        onComplete?.(completionData);
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
                <label
                  key={option}
                  className={`radio-item ${responses[step.id] === option ? 'selected' : ''}`}
                >
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
                <label
                  key={option}
                  className={`checkbox-item ${
                    (responses[step.id] || []).includes(option) ? 'selected' : ''
                  }`}
                >
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
          width: 100%;
          min-height: 100dvh;
          height: 100dvh;
          margin: 0;
          padding: 0;
          overflow-y: auto;
          overscroll-behavior: contain;
          background: #212121;
          color: #ececec;
          display: flex;
          flex-direction: column;
        }

        .onboarding-header {
          width: min(680px, 100%);
          margin: 0 auto;
          padding: 1.25rem 1.25rem 0;
          flex-shrink: 0;
        }

        .progress-bar {
          width: 100%;
          height: 4px;
          background: #3a3a3a;
          border-radius: 999px;
          overflow: hidden;
          margin-bottom: 0.75rem;
        }

        .progress-fill {
          height: 100%;
          background: #f4f4f4;
          transition: width 0.35s ease;
          border-radius: 999px;
        }

        .step-counter {
          text-align: right;
          font-size: 0.8rem;
          color: #8f8f8f;
          font-weight: 500;
        }

        .onboarding-content {
          width: min(680px, 100%);
          margin: 0 auto;
          padding: 1.5rem 1.25rem 2rem;
          text-align: center;
          flex: 1;
          animation-duration: 0.22s;
          animation-timing-function: ease-out;
        }

        .onboarding-content.fade-in {
          animation-name: fadeIn;
        }

        .onboarding-content.fade-out {
          animation-name: fadeOut;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-8px); }
        }

        .step-icon {
          min-height: 50px;
          margin-bottom: 0.6rem;
          display: flex;
          justify-content: center;
          opacity: 0.9;
        }

        .step-title {
          font-size: clamp(1.55rem, 5vw, 2rem);
          font-weight: 700;
          color: #f5f5f5;
          margin-bottom: 0.45rem;
          letter-spacing: -0.02em;
        }

        .step-description {
          font-size: 0.95rem;
          color: #a7a7a7;
          margin-bottom: 1.6rem;
        }

        .question-container {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          text-align: left;
          margin: 1rem auto 0;
          width: min(560px, 100%);
        }

        .question {
          font-weight: 600;
          color: #f0f0f0;
          font-size: 1rem;
          line-height: 1.45;
          margin-bottom: 0.2rem;
        }

        .form-input {
          width: 100%;
          min-height: 50px;
          padding: 0.8rem 0.9rem;
          border: 1px solid #4a4a4a;
          border-radius: 12px;
          background: #2f2f2f;
          color: #f3f3f3;
          font-size: 16px;
          font-family: inherit;
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }

        .form-input::placeholder {
          color: #858585;
        }

        .form-input:focus {
          outline: none;
          border-color: #777;
          box-shadow: 0 0 0 3px rgba(255,255,255,0.06);
        }

        .select-input {
          cursor: pointer;
          color-scheme: dark;
        }

        .radio-group,
        .checkbox-group {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }

        .radio-item,
        .checkbox-item {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          min-height: 54px;
          padding: 0.85rem 0.95rem;
          border: 1px solid #474747;
          border-radius: 12px;
          background: #2b2b2b;
          color: #e9e9e9;
          cursor: pointer;
          transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
          font-weight: 500;
          line-height: 1.35;
        }

        .radio-item:hover,
        .checkbox-item:hover {
          background: #333;
          border-color: #606060;
        }

        .radio-item.selected,
        .checkbox-item.selected {
          background: #393939;
          border-color: #8a8a8a;
          color: #ffffff;
        }

        .radio-item:active,
        .checkbox-item:active {
          transform: scale(0.99);
        }

        .radio-item input,
        .checkbox-item input {
          flex: 0 0 auto;
          width: 20px;
          height: 20px;
          cursor: pointer;
          accent-color: #f4f4f4;
        }

        .onboarding-footer {
          position: sticky;
          bottom: 0;
          z-index: 10;
          width: 100%;
          margin-top: auto;
          padding: 0.85rem max(1rem, env(safe-area-inset-right))
            calc(0.85rem + env(safe-area-inset-bottom))
            max(1rem, env(safe-area-inset-left));
          display: grid;
          grid-template-columns: auto auto minmax(120px, 1fr);
          gap: 0.6rem;
          background: rgba(33,33,33,0.96);
          border-top: 1px solid #343434;
          backdrop-filter: blur(14px);
        }

        button {
          min-height: 48px;
          padding: 0.75rem 1rem;
          border: none;
          border-radius: 12px;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.18s ease, opacity 0.18s ease, transform 0.18s ease;
        }

        .btn-primary {
          background: #f4f4f4;
          color: #111;
        }

        .btn-primary:hover:not(:disabled) {
          background: #ffffff;
        }

        .btn-primary:active:not(:disabled) {
          transform: scale(0.99);
        }

        .btn-primary:disabled {
          background: #3a3a3a;
          color: #777;
          opacity: 1;
          cursor: not-allowed;
        }

        .btn-secondary,
        .btn-tertiary {
          background: #2b2b2b;
          color: #c8c8c8;
          border: 1px solid #444;
        }

        .btn-secondary:hover:not(:disabled),
        .btn-tertiary:hover {
          background: #333;
          color: #fff;
        }

        .btn-secondary:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .onboarding-complete {
          min-height: 100dvh;
          display: grid;
          place-content: center;
          text-align: center;
          padding: 2rem;
          background: #212121;
          color: #ececec;
        }

        .onboarding-complete h2 {
          font-size: 1.8rem;
          margin: 1.25rem 0 0.5rem;
          color: #f5f5f5;
        }

        .onboarding-complete p {
          color: #aaa;
          margin-bottom: 0.75rem;
        }

        @media (max-width: 640px) {
          .onboarding-header {
            padding: 1rem 1rem 0;
          }

          .onboarding-content {
            padding: 1rem 1rem 1.5rem;
          }

          .step-icon {
            margin-bottom: 0.35rem;
          }

          .step-description {
            margin-bottom: 1.1rem;
          }

          .question-container {
            margin-top: 0.7rem;
          }

          .onboarding-footer {
            grid-template-columns: 0.8fr 0.8fr 1.4fr;
            padding-top: 0.7rem;
          }

          button {
            padding: 0.7rem 0.55rem;
            font-size: 0.9rem;
          }
        }

        @media (max-height: 680px) {
          .step-icon {
            display: none;
          }

          .onboarding-content {
            padding-top: 0.75rem;
          }

          .step-description {
            margin-bottom: 0.8rem;
          }

          .radio-item,
          .checkbox-item {
            min-height: 48px;
            padding: 0.65rem 0.8rem;
          }
        }
      `}</style>
    </div>
  );
};

export default ProgressiveOnboarding;
