"use client";

import React, { useState, useEffect } from "react";
import { JobDetails } from "@/lib/jobExtractor";

interface AutoFilledJobFormProps {
  userId: string;
  extractedJobDetails?: JobDetails;
  onSubmit?: (formData: Record<string, any>) => void;
  onCancel?: () => void;
}

export function AutoFilledJobForm({
  userId,
  extractedJobDetails,
  onSubmit,
  onCancel,
}: AutoFilledJobFormProps) {
  const [formData, setFormData] = useState({
    title: extractedJobDetails?.title || "",
    company: extractedJobDetails?.company || "",
    description: extractedJobDetails?.description || "",
    location: extractedJobDetails?.location || "",
    salary: extractedJobDetails?.salary || "",
    jobType: extractedJobDetails?.jobType || "full-time",
    contactName: extractedJobDetails?.contactName || "",
    contactPhone: extractedJobDetails?.contactPhone || "",
    contactEmail: extractedJobDetails?.contactEmail || "",
    startDate: extractedJobDetails?.startDate || "",
    deadline: extractedJobDetails?.deadline || "",
    notes: extractedJobDetails?.notes || "",
  });

  const [confidence, setConfidence] = useState(
    extractedJobDetails?.confidence || 0
  );
  const [extractedFields, setExtractedFields] = useState(
    extractedJobDetails?.extractedFields || []
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(formData);
  };

  const getFieldConfidence = (fieldName: string): number => {
    if (!extractedFields.includes(fieldName)) return 0;
    // Higher confidence for fields that were extracted
    return 80 + Math.random() * 20; // 80-100
  };

  const ConfidenceBadge = ({ fieldName }: { fieldName: string }) => {
    const isExtracted = extractedFields.includes(fieldName);
    if (!isExtracted) return null;

    return (
      <div className="confidence-badge">
        <span className="confidence-icon">✓</span>
        <span className="confidence-text">Auto-filled</span>
      </div>
    );
  };

  return (
    <div className="auto-filled-form">
      <div className="form-header">
        <h3>📋 Job Details Form</h3>
        <div className="confidence-display">
          <div className="confidence-bar">
            <div
              className="confidence-fill"
              style={{ width: `${confidence}%` }}
            ></div>
          </div>
          <span className="confidence-label">{confidence}% auto-filled</span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="job-title">Job Title *</label>
            <input
              id="job-title"
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Software Engineer"
              required
            />
            <ConfidenceBadge fieldName="title" />
          </div>
          <div className="form-group">
            <label htmlFor="job-company">Company *</label>
            <input
              id="job-company"
              type="text"
              name="company"
              value={formData.company}
              onChange={handleChange}
              placeholder="e.g. Acme Corp"
              required
            />
            <ConfidenceBadge fieldName="company" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Location</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="e.g. San Francisco, CA"
            />
            <ConfidenceBadge fieldName="location" />
          </div>
          <div className="form-group">
            <label>Job Type</label>
            <select
              name="jobType"
              value={formData.jobType}
              onChange={handleChange}
            >
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
              <option value="contract">Contract</option>
              <option value="temporary">Temporary</option>
            </select>
            <ConfidenceBadge fieldName="jobType" />
          </div>
        </div>

        <div className="form-group full-width">
          <label>Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Job description and responsibilities"
            rows={3}
          />
          <ConfidenceBadge fieldName="description" />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Salary</label>
            <input
              type="text"
              name="salary"
              value={formData.salary}
              onChange={handleChange}
              placeholder="e.g. $80k-$120k"
            />
            <ConfidenceBadge fieldName="salary" />
          </div>
          <div className="form-group">
            <label>Start Date</label>
            <input
              type="text"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              placeholder="e.g. March 15"
            />
            <ConfidenceBadge fieldName="startDate" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Application Deadline</label>
            <input
              type="text"
              name="deadline"
              value={formData.deadline}
              onChange={handleChange}
              placeholder="e.g. March 30"
            />
            <ConfidenceBadge fieldName="deadline" />
          </div>
          <div className="form-group"></div>
        </div>

        <div className="form-section-divider">Contact Information</div>

        <div className="form-row">
          <div className="form-group">
            <label>Contact Name</label>
            <input
              type="text"
              name="contactName"
              value={formData.contactName}
              onChange={handleChange}
              placeholder="e.g. John Smith"
            />
            <ConfidenceBadge fieldName="contactName" />
          </div>
          <div className="form-group">
            <label>Contact Email</label>
            <input
              type="email"
              name="contactEmail"
              value={formData.contactEmail}
              onChange={handleChange}
              placeholder="contact@company.com"
            />
            <ConfidenceBadge fieldName="contactEmail" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Contact Phone</label>
            <input
              type="tel"
              name="contactPhone"
              value={formData.contactPhone}
              onChange={handleChange}
              placeholder="(555) 123-4567"
            />
            <ConfidenceBadge fieldName="contactPhone" />
          </div>
          <div className="form-group"></div>
        </div>

        <div className="form-group full-width">
          <label>Additional Notes</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Any additional notes or context"
            rows={2}
          />
          <ConfidenceBadge fieldName="notes" />
        </div>

        <div className="button-group">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            💾 Save Job
          </button>
        </div>
      </form>

      <style jsx>{`
        .auto-filled-form {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
          max-width: 700px;
          margin: 0 auto;
        }

        .form-header {
          margin-bottom: 20px;
        }

        .form-header h3 {
          margin: 0 0 12px;
          font-size: 18px;
          font-weight: 600;
          color: #333;
        }

        .confidence-display {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .confidence-bar {
          flex: 1;
          height: 6px;
          background: #e0e0e0;
          border-radius: 3px;
          overflow: hidden;
        }

        .confidence-fill {
          height: 100%;
          background: linear-gradient(90deg, #4caf50, #2196f3);
          transition: width 0.3s ease;
        }

        .confidence-label {
          font-size: 12px;
          font-weight: 600;
          color: #666;
          white-space: nowrap;
        }

        form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .form-row .form-group:nth-child(n + 3) {
          grid-column: auto;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          position: relative;
        }

        .form-group.full-width {
          grid-column: 1 / -1;
        }

        .form-group label {
          font-size: 13px;
          font-weight: 600;
          color: #333;
        }

        .form-group input,
        .form-group textarea,
        .form-group select {
          padding: 10px;
          border: 1px solid #d0d0d0;
          border-radius: 6px;
          font-family: inherit;
          font-size: 13px;
          color: #333;
          transition: all 0.2s ease;
        }

        .form-group input:focus,
        .form-group textarea:focus,
        .form-group select:focus {
          outline: none;
          border-color: #4171ff;
          box-shadow: 0 0 0 3px rgba(65, 113, 255, 0.1);
        }

        .form-group textarea {
          resize: vertical;
          font-family: "Courier New", monospace;
          font-size: 12px;
        }

        .confidence-badge {
          position: absolute;
          top: 6px;
          right: 10px;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          background: #e8f5e9;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          color: #2e7d32;
        }

        .confidence-icon {
          font-size: 10px;
        }

        .form-section-divider {
          margin-top: 8px;
          padding-top: 12px;
          border-top: 2px solid #f0f0f0;
          font-size: 12px;
          font-weight: 700;
          color: #999;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .button-group {
          display: flex;
          gap: 10px;
          margin-top: 16px;
        }

        .btn {
          padding: 12px 20px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          flex: 1;
        }

        .btn-primary {
          background: #4171ff;
          color: white;
        }

        .btn-primary:hover {
          background: #2e5dd9;
        }

        .btn-secondary {
          background: #f0f0f0;
          color: #333;
          border: 1px solid #d0d0d0;
        }

        .btn-secondary:hover {
          background: #e0e0e0;
        }

        @media (max-width: 768px) {
          .form-row {
            grid-template-columns: 1fr;
          }

          .auto-filled-form {
            padding: 16px;
          }

          .button-group {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}

export default AutoFilledJobForm;
