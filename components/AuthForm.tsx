'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { firebaseBackend } from '../lib/firebaseBackend';

interface AuthFormProps {
  onSuccess?: () => void;
  initialMode?: 'login' | 'signup';
}

export const AuthForm: React.FC<AuthFormProps> = ({ onSuccess, initialMode = 'login' }) => {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (mode === 'signup') {
        if (!displayName.trim()) {
          setError('Please enter your name');
          setIsLoading(false);
          return;
        }

        await firebaseBackend.initialize();
        const user = await firebaseBackend.signUp(email, password, displayName);

        if (user) {
          setSuccess('Account created! Redirecting...');
          setEmail('');
          setPassword('');
          setDisplayName('');
          setTimeout(() => {
            router.push('/dashboard');
          }, 1000);
        } else {
          setError('Sign up failed');
        }
      } else {
        // Login
        await firebaseBackend.initialize();
        const user = await firebaseBackend.login(email, password);

        if (user) {
          setSuccess('Logged in successfully!');
          setEmail('');
          setPassword('');
          setTimeout(() => {
            router.push('/dashboard');
          }, 1000);
        } else {
          setError('Login failed');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
    setSuccess('');
    setEmail('');
    setPassword('');
    setDisplayName('');
  };

  return (
    <div className="auth-form-container">
      <div className="auth-form">
        <h2>{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
        <p className="subtitle">
          {mode === 'login'
            ? 'Sign in to sync your conversations across devices'
            : 'Sign up to start using intelligent business AI'}
        </p>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="form-group">
              <label htmlFor="name">Your Name</label>
              <input
                id="name"
                type="text"
                placeholder="John Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isLoading}
                autocomplete="name"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              autocomplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
            {mode === 'login' && <p className="help-text">At least 6 characters</p>}
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <button type="submit" className="submit-btn" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="spinner"></span>
                {mode === 'login' ? 'Signing in...' : 'Creating account...'}
              </>
            ) : mode === 'login' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="toggle-mode">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button type="button" onClick={toggleMode} className="link-btn">
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" onClick={toggleMode} className="link-btn">
                Sign in
              </button>
            </>
          )}
        </div>

        <div className="info-box">
          <p>
            💡 <strong>Tip:</strong> Use the same email on any device to sync your conversations
            automatically.
          </p>
        </div>
      </div>

      <style jsx>{`
        .auth-form-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 1rem;
        }

        .auth-form {
          background: white;
          padding: 2.5rem;
          border-radius: 1rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          width: 100%;
          max-width: 400px;
        }

        .auth-form h2 {
          margin: 0 0 0.5rem;
          color: #333;
          font-size: 1.75rem;
          font-weight: 700;
        }

        .subtitle {
          margin: 0 0 1.5rem;
          color: #666;
          font-size: 0.9rem;
          line-height: 1.4;
        }

        form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-group label {
          font-weight: 600;
          color: #333;
          font-size: 0.9rem;
        }

        .form-group input {
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 0.5rem;
          font-size: 0.95rem;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .form-group input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          background: rgba(102, 126, 234, 0.02);
        }

        .form-group input:disabled {
          background: #f5f5f5;
          color: #999;
        }

        .help-text {
          margin: 0;
          font-size: 0.75rem;
          color: #999;
        }

        .error-message {
          padding: 0.75rem;
          background: #fee;
          border: 1px solid #fcc;
          border-radius: 0.4rem;
          color: #c33;
          font-size: 0.9rem;
          text-align: center;
        }

        .success-message {
          padding: 0.75rem;
          background: #efe;
          border: 1px solid #cfc;
          border-radius: 0.4rem;
          color: #3c3;
          font-size: 0.9rem;
          text-align: center;
        }

        .submit-btn {
          padding: 0.75rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 0.5rem;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          min-height: 44px;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
        }

        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .toggle-mode {
          margin: 1.5rem 0 0;
          text-align: center;
          color: #666;
          font-size: 0.9rem;
        }

        .link-btn {
          background: none;
          border: none;
          color: #667eea;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.2s ease;
          padding: 0;
          font-size: inherit;
        }

        .link-btn:hover {
          text-decoration: underline;
          color: #764ba2;
        }

        .info-box {
          margin-top: 1.5rem;
          padding: 1rem;
          background: #f0f4ff;
          border-radius: 0.5rem;
          border-left: 3px solid #667eea;
        }

        .info-box p {
          margin: 0;
          font-size: 0.85rem;
          color: #333;
          line-height: 1.4;
        }

        .info-box strong {
          color: #667eea;
        }

        @media (max-width: 480px) {
          .auth-form {
            padding: 1.5rem;
          }

          .auth-form h2 {
            font-size: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
};

export default AuthForm;
