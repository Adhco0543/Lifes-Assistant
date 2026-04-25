"use client";

import { useEffect, useState } from "react";
import {
  AutonomySettings,
  AutonomySettingsManager,
  DEFAULT_AUTONOMY_SETTINGS,
} from "@/lib/autonomySettings";

interface AutonomySettingsFormProps {
  userId: string;
  onSave?: (settings: AutonomySettings) => void;
}

export function AutonomySettingsForm({ userId, onSave }: AutonomySettingsFormProps) {
  const [settings, setSettings] = useState<AutonomySettings>(DEFAULT_AUTONOMY_SETTINGS);
  const [selectedPreset, setSelectedPreset] = useState<string>("balanced");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "email" | "quotes" | "jobs" | "background" | "notifications" | "safety"
  >("email");

  useEffect(() => {
    loadSettings();
  }, [userId]);

  const loadSettings = async () => {
    try {
      const loaded = await AutonomySettingsManager.getSettings(userId);
      setSettings(loaded);
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await AutonomySettingsManager.updateSettings(userId, settings);
      onSave?.(settings);
      setSaving(false);
    } catch (error) {
      console.error("Error saving settings:", error);
      setSaving(false);
    }
  };

  const applyPreset = async (preset: string) => {
    try {
      setSaving(true);
      await AutonomySettingsManager.applyPreset(userId, preset as any);
      await loadSettings();
      setSelectedPreset(preset);
      setSaving(false);
    } catch (error) {
      console.error("Error applying preset:", error);
      setSaving(false);
    }
  };

  const presets = AutonomySettingsManager.getPresets();

  return (
    <div className="autonomy-settings">
      <div className="settings-header">
        <h2>🎛️ Autonomy Settings</h2>
        <p className="header-desc">Control how much the assistant can do automatically</p>
      </div>

      {/* Preset Selector */}
      <div className="preset-section">
        <h3>Quick Presets</h3>
        <div className="preset-buttons">
          {Object.entries(presets).map(([key, preset]) => (
            <button
              key={key}
              className={`preset-btn ${selectedPreset === key ? "active" : ""}`}
              onClick={() => applyPreset(key)}
              disabled={saving}
            >
              <div className="preset-name">{preset.name}</div>
              <div className="preset-desc">{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="settings-tabs">
        <button
          className={`tab ${activeTab === "email" ? "active" : ""}`}
          onClick={() => setActiveTab("email")}
        >
          📧 Email
        </button>
        <button
          className={`tab ${activeTab === "quotes" ? "active" : ""}`}
          onClick={() => setActiveTab("quotes")}
        >
          📝 Quotes
        </button>
        <button
          className={`tab ${activeTab === "jobs" ? "active" : ""}`}
          onClick={() => setActiveTab("jobs")}
        >
          🔍 Jobs
        </button>
        <button
          className={`tab ${activeTab === "background" ? "active" : ""}`}
          onClick={() => setActiveTab("background")}
        >
          🌙 Background
        </button>
        <button
          className={`tab ${activeTab === "notifications" ? "active" : ""}`}
          onClick={() => setActiveTab("notifications")}
        >
          🔔 Notifications
        </button>
        <button
          className={`tab ${activeTab === "safety" ? "active" : ""}`}
          onClick={() => setActiveTab("safety")}
        >
          🔒 Safety
        </button>
      </div>

      <div className="settings-content">
        {/* Email Settings */}
        {activeTab === "email" && (
          <div className="tab-content">
            <h3>Email Behavior</h3>

            <div className="setting-group">
              <label className="setting-label">Default Email Behavior</label>
              <select
                id="email-behavior"
                name="email-behavior"
                value={settings.emailBehavior}
                onChange={(e) =>
                  setSettings({ ...settings, emailBehavior: e.target.value as any })
                }
              >
                <option value="ask">🛑 Ask before sending</option>
                <option value="draft_only">✏️ Auto-draft only</option>
                <option value="auto_send">✉️ Auto-send</option>
              </select>
              <p className="setting-help">
                Controls whether the assistant should draft, ask, or send emails automatically.
              </p>
            </div>

            <div className="setting-group">
              <label className="setting-label">Email Categories</label>

              <div className="category-setting">
                <label htmlFor="email-customer">Customer Emails</label>
                <select
                  id="email-customer"
                  name="email-customer"
                  value={settings.emailCategories.customer}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      emailCategories: {
                        ...settings.emailCategories,
                        customer: e.target.value as any,
                      },
                    })
                  }
                >
                  <option value="ask">Ask</option>
                  <option value="auto_draft">Auto-draft</option>
                  <option value="auto_send">Auto-send</option>
                </select>
              </div>

              <div className="category-setting">
                <label htmlFor="email-followup">Follow-up Emails</label>
                <select
                  id="email-followup"
                  name="email-followup"
                  value={settings.emailCategories.followup}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      emailCategories: {
                        ...settings.emailCategories,
                        followup: e.target.value as any,
                      },
                    })
                  }
                >
                  <option value="ask">Ask</option>
                  <option value="auto_draft">Auto-draft</option>
                  <option value="auto_send">Auto-send</option>
                </select>
              </div>

              <div className="category-setting">
                <label htmlFor="email-invoice">Invoice Emails</label>
                <select
                  id="email-invoice"
                  name="email-invoice"
                  value={settings.emailCategories.invoice}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      emailCategories: {
                        ...settings.emailCategories,
                        invoice: e.target.value as any,
                      },
                    })
                  }
                >
                  <option value="ask">Ask</option>
                  <option value="auto_draft">Auto-draft</option>
                  <option value="auto_send">Auto-send</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Quotes Settings */}
        {activeTab === "quotes" && (
          <div className="tab-content">
            <h3>Quote Settings</h3>

            <div className="setting-group">
              <label className="setting-label">Quote Behavior</label>
              <select
                id="quote-behavior"
                name="quote-behavior"
                value={settings.quoteBehavior}
                onChange={(e) =>
                  setSettings({ ...settings, quoteBehavior: e.target.value as any })
                }
              >
                <option value="ask">🛑 Ask before creating</option>
                <option value="auto_create">✅ Auto-create, ask before send</option>
                <option value="auto_send">✉️ Auto-send</option>
              </select>
            </div>

            <div className="setting-group">
              <label className="setting-label">Auto-send Threshold</label>
              <div className="input-with-label">
                <span>$</span>
                <input
                  id="auto-send-threshold"
                  name="auto-send-threshold"
                  type="number"
                  value={settings.autoSendQuotesUnder}
                  onChange={(e) =>
                    setSettings({ ...settings, autoSendQuotesUnder: parseInt(e.target.value) })
                  }
                  placeholder="0"
                />
              </div>
              <p className="setting-help">Auto-send quotes under this amount (0 = never)</p>
            </div>
          </div>
        )}

        {/* Job Search Settings */}
        {activeTab === "jobs" && (
          <div className="tab-content">
            <h3>Job Search Settings</h3>

            <div className="setting-group">
              <label className="setting-label">Job Search Behavior</label>
              <select
                id="job-search-behavior"
                name="job-search-behavior"
                value={settings.jobSearchBehavior}
                onChange={(e) =>
                  setSettings({ ...settings, jobSearchBehavior: e.target.value as any })
                }
              >
                <option value="ask">🛑 Ask before searching</option>
                <option value="auto_search">🔍 Auto-search</option>
                <option value="auto_apply">📤 Auto-apply to jobs</option>
              </select>
            </div>

            <div className="setting-group">
              <label className="setting-label">Search Frequency</label>
              <select
                id="search-frequency"
                name="search-frequency"
                value={settings.autoSearchFrequency}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    autoSearchFrequency: e.target.value as any,
                  })
                }
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="on_demand">On demand</option>
              </select>
            </div>
          </div>
        )}

        {/* Background Mode Settings */}
        {activeTab === "background" && (
          <div className="tab-content">
            <h3>Background Mode</h3>

            <div className="setting-group">
              <label className="checkbox-label">
                <input
                  id="background-mode"
                  name="background-mode"
                  type="checkbox"
                  checked={settings.backgroundMode}
                  onChange={(e) =>
                    setSettings({ ...settings, backgroundMode: e.target.checked })
                  }
                />
                <span>Allow assistant to work when I'm offline</span>
              </label>
              <p className="setting-help">
                When enabled, the assistant can execute tasks automatically even when you're not using the app.
              </p>
            </div>

            {settings.backgroundMode && (
              <div className="setting-group">
                <label className="setting-label">Background Behavior</label>
                <select
                  id="background-behavior"
                  name="background-behavior"
                  value={settings.backgroundModeBehavior}
                  onChange={(e) =>
                    setSettings({ ...settings, backgroundModeBehavior: e.target.value as any })
                  }
                >
                  <option value="silent">Silent (minimal notifications)</option>
                  <option value="draft_only">Draft only</option>
                  <option value="auto_execute">Auto-execute</option>
                </select>
              </div>
            )}

            <div className="setting-group">
              <label className="checkbox-label">
                <input
                  id="disable-during-hours"
                  name="disable-during-hours"
                  type="checkbox"
                  checked={settings.disableDuringHours?.enabled || false}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      disableDuringHours: {
                        ...settings.disableDuringHours,
                        enabled: e.target.checked,
                      },
                    })
                  }
                />
                <span>Disable automation during certain hours</span>
              </label>
            </div>

            {settings.disableDuringHours?.enabled && (
              <div className="setting-group">
                <label className="setting-label">Disabled Hours</label>
                <div className="time-inputs">
                  <input
                    id="disable-start-time"
                    name="disable-start-time"
                    type="time"
                    value={settings.disableDuringHours?.startTime || "18:00"}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        disableDuringHours: {
                          ...settings.disableDuringHours,
                          startTime: e.target.value,
                        },
                      })
                    }
                  />
                  <span>to</span>
                  <input
                    id="disable-end-time"
                    name="disable-end-time"
                    type="time"
                    value={settings.disableDuringHours?.endTime || "08:00"}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        disableDuringHours: {
                          ...settings.disableDuringHours,
                          endTime: e.target.value,
                        },
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notification Settings */}
        {activeTab === "notifications" && (
          <div className="tab-content">
            <h3>Notification Preferences</h3>

            <div className="setting-group">
              <label className="checkbox-label">
                <input
                  id="notify-approvals"
                  name="notify-approvals"
                  type="checkbox"
                  checked={settings.notifyOnApprovals}
                  onChange={(e) =>
                    setSettings({ ...settings, notifyOnApprovals: e.target.checked })
                  }
                />
                <span>Notify when tasks need approval</span>
              </label>
            </div>

            <div className="setting-group">
              <label className="checkbox-label">
                <input
                  id="notify-auto-execute"
                  name="notify-auto-execute"
                  type="checkbox"
                  checked={settings.notifyOnAutoExecute}
                  onChange={(e) =>
                    setSettings({ ...settings, notifyOnAutoExecute: e.target.checked })
                  }
                />
                <span>Notify when tasks auto-execute</span>
              </label>
            </div>

            <div className="setting-group">
              <label className="checkbox-label">
                <input
                  id="notify-errors"
                  name="notify-errors"
                  type="checkbox"
                  checked={settings.notifyOnErrors}
                  onChange={(e) =>
                    setSettings({ ...settings, notifyOnErrors: e.target.checked })
                  }
                />
                <span>Notify on errors</span>
              </label>
            </div>

            <div className="setting-group">
              <label className="checkbox-label">
                <input
                  id="notify-quote-requests"
                  name="notify-quote-requests"
                  type="checkbox"
                  checked={settings.notifyOnQuoteRequests}
                  onChange={(e) =>
                    setSettings({ ...settings, notifyOnQuoteRequests: e.target.checked })
                  }
                />
                <span>Notify on quote requests</span>
              </label>
            </div>

            <div className="setting-group">
              <label className="setting-label">Memory Retention</label>
              <select
                id="memory-retention"
                name="memory-retention"
                value={settings.memoryRetention}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    memoryRetention: e.target.value as any,
                  })
                }
              >
                <option value="1_week">1 Week</option>
                <option value="1_month">1 Month</option>
                <option value="3_months">3 Months</option>
                <option value="unlimited">Unlimited</option>
              </select>
              <p className="setting-help">How long to keep decision history and logs</p>
            </div>
          </div>
        )}

        {/* Safety Settings */}
        {activeTab === "safety" && (
          <div className="tab-content">
            <h3>Safety Settings</h3>

            <div className="setting-group">
              <label className="setting-label">Daily Execution Limit</label>
              <input
                id="daily-execution-limit"
                name="daily-execution-limit"
                type="number"
                value={settings.dailyExecutionLimit}
                onChange={(e) =>
                  setSettings({ ...settings, dailyExecutionLimit: parseInt(e.target.value) })
                }
              />
              <p className="setting-help">Maximum number of tools executed per day (0 = unlimited)</p>
            </div>

            <div className="setting-group">
              <label className="setting-label">Confirmation Threshold</label>
              <div className="input-with-label">
                <span>$</span>
                <input
                  id="confirmation-threshold"
                  name="confirmation-threshold"
                  type="number"
                  value={settings.requireConfirmationForLargeAmounts}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      requireConfirmationForLargeAmounts: parseInt(e.target.value),
                    })
                  }
                />
              </div>
              <p className="setting-help">Always ask for confirmation above this amount</p>
            </div>

            <div className="setting-group">
              <label className="setting-label">Follow-up Behavior</label>
              <label className="checkbox-label">
                <input
                  id="auto-followup-enabled"
                  name="auto-followup-enabled"
                  type="checkbox"
                  checked={settings.autoFollowUpRules.enabled}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      autoFollowUpRules: {
                        ...settings.autoFollowUpRules,
                        enabled: e.target.checked,
                      },
                    })
                  }
                />
                <span>Enable automatic follow-ups</span>
              </label>
            </div>

            {settings.autoFollowUpRules.enabled && (
              <div className="setting-group">
                <label className="setting-label">Follow-up Timing</label>
                <div className="followup-settings">
                  <div>
                    <label htmlFor="days-after-quote">Days after quote</label>
                    <input
                      id="days-after-quote"
                      name="days-after-quote"
                      type="number"
                      value={settings.autoFollowUpRules.daysAfterQuote}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          autoFollowUpRules: {
                            ...settings.autoFollowUpRules,
                            daysAfterQuote: parseInt(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor="days-after-no-response">Days after no response</label>
                    <input
                      id="days-after-no-response"
                      name="days-after-no-response"
                      type="number"
                      value={settings.autoFollowUpRules.daysAfterNoResponse}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          autoFollowUpRules: {
                            ...settings.autoFollowUpRules,
                            daysAfterNoResponse: parseInt(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="settings-footer">
        <button
          className="btn btn-secondary"
          onClick={loadSettings}
          disabled={saving}
        >
          Reset to Saved
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      <style jsx>{`
        .autonomy-settings {
          background: white;
          border-radius: 12px;
          padding: 24px;
          max-width: 900px;
        }

        .settings-header {
          margin-bottom: 24px;
        }

        .settings-header h2 {
          margin: 0 0 8px 0;
          font-size: 24px;
          color: #333;
        }

        .header-desc {
          margin: 0;
          color: #666;
          font-size: 14px;
        }

        .preset-section {
          margin-bottom: 24px;
          padding-bottom: 24px;
          border-bottom: 1px solid #eee;
        }

        .preset-section h3 {
          margin: 0 0 12px 0;
          font-size: 16px;
          color: #333;
        }

        .preset-buttons {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }

        .preset-btn {
          background: #f5f5f5;
          border: 2px solid #ddd;
          border-radius: 8px;
          padding: 12px;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .preset-btn:hover {
          border-color: #667eea;
          background: #f0f0f0;
        }

        .preset-btn.active {
          background: #667eea;
          border-color: #667eea;
          color: white;
        }

        .preset-name {
          font-weight: 600;
          margin-bottom: 4px;
        }

        .preset-desc {
          font-size: 12px;
          opacity: 0.8;
        }

        .settings-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          border-bottom: 2px solid #eee;
          overflow-x: auto;
        }

        .tab {
          background: none;
          border: none;
          padding: 12px 16px;
          cursor: pointer;
          font-size: 14px;
          color: #666;
          border-bottom: 3px solid transparent;
          transition: all 0.2s ease;
        }

        .tab:hover {
          color: #333;
        }

        .tab.active {
          color: #667eea;
          border-bottom-color: #667eea;
        }

        .settings-content {
          min-height: 300px;
        }

        .tab-content {
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .tab-content h3 {
          margin: 0 0 16px 0;
          font-size: 18px;
          color: #333;
        }

        .setting-group {
          margin-bottom: 20px;
        }

        .setting-label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #333;
          font-size: 14px;
        }

        select,
        input[type="number"],
        input[type="time"] {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          background: white;
        }

        select:focus,
        input[type="number"]:focus,
        input[type="time"]:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 14px;
          color: #333;
        }

        .checkbox-label input[type="checkbox"] {
          width: auto;
          cursor: pointer;
        }

        .category-setting,
        .time-inputs,
        .followup-settings {
          background: #f9f9f9;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 12px;
        }

        .category-setting label,
        .time-inputs label,
        .followup-settings label {
          display: block;
          margin-bottom: 6px;
          font-size: 12px;
          color: #666;
          font-weight: 600;
        }

        .category-setting select {
          margin-bottom: 8px;
        }

        .time-inputs {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .time-inputs input {
          flex: 1;
        }

        .time-inputs span {
          color: #666;
          flex-shrink: 0;
        }

        .followup-settings {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .input-with-label {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .input-with-label span {
          font-weight: 600;
          color: #333;
        }

        .input-with-label input {
          flex: 1;
        }

        .setting-help {
          margin: 6px 0 0 0;
          font-size: 12px;
          color: #999;
        }

        .settings-footer {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid #eee;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-primary {
          background: #667eea;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #5568d3;
        }

        .btn-secondary {
          background: #f5f5f5;
          color: #333;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #e5e5e5;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .autonomy-settings {
            padding: 16px;
          }

          .preset-buttons {
            grid-template-columns: 1fr;
          }

          .settings-tabs {
            gap: 0;
          }

          .tab {
            padding: 8px 12px;
            font-size: 12px;
          }

          .followup-settings {
            grid-template-columns: 1fr;
          }

          .settings-footer {
            flex-direction: column-reverse;
          }

          .btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

export default AutonomySettingsForm;
