'use client';

import React, { useState } from "react";

interface AssistantTransparencyPanelProps {
  knownItems?: string[];
  capabilities?: string[];
  neverDo?: string[];
  standingPermissions?: string[];
  onRevokeStandingPermissions?: () => void;
}

export function AssistantTransparencyPanel({
  knownItems = ["Your selected mode and priorities", "Facts you explicitly approved for memory"],
  capabilities = ["Organize Radar items", "Draft replies and quotes", "Suggest reminders and next steps"],
  neverDo = [],
  standingPermissions = [],
  onRevokeStandingPermissions,
}: AssistantTransparencyPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="assistant-transparency">
      <button className="transparency-summary" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="status-dot" />
        <span>
          <strong>What I know / What I can do</strong>
          <small>Approval-first · nothing is sent or changed without you</small>
        </span>
        <b>{open ? "−" : "+"}</b>
      </button>

      {open && (
        <div className="transparency-detail">
          <div>
            <h3>What I know</h3>
            <ul>{knownItems.map((item) => <li key={item}>{item}</li>)}</ul>
            <p>New facts are saved only after you approve “Save this?”</p>
          </div>
          <div>
            <h3>What I can do</h3>
            <ul>{capabilities.map((item) => <li key={item}>{item}</li>)}</ul>
            <p>I ask before sending, buying, deleting, booking, or changing outside data.</p>
          </div>
          <div className="control-row">
            <span><strong>Never do</strong><small>{neverDo.length ? neverDo.join(" · ") : "No custom restrictions added"}</small></span>
            <span><strong>Standing permissions</strong><small>{standingPermissions.length ? standingPermissions.join(" · ") : "None granted"}</small></span>
            {standingPermissions.length > 0 && <button onClick={onRevokeStandingPermissions}>Revoke all</button>}
          </div>
        </div>
      )}

      <style jsx>{`
        .assistant-transparency{margin:0 0 1.5rem;border:1px solid #d8e0d9;border-radius:14px;background:#f8faf8;overflow:hidden}
        .transparency-summary{width:100%;border:0;background:transparent;padding:14px 16px;display:flex;align-items:center;gap:11px;text-align:left;color:#1f2937;cursor:pointer}
        .status-dot{width:9px;height:9px;border-radius:50%;background:#4aa76a;box-shadow:0 0 0 4px rgba(74,167,106,.12)}
        .transparency-summary span:nth-child(2){flex:1}.transparency-summary strong,.transparency-summary small{display:block}.transparency-summary strong{font-size:.9rem}.transparency-summary small{margin-top:3px;color:#66736a;font-size:.75rem}.transparency-summary b{color:#708078}
.transparency-detail{display:grid;grid-template-columns:1fr 1fr;gap:16px;border-top:1px solid #dfe5df;padding:15px 16px;background:#fff}.control-row{grid-column:1/-1;border-top:1px solid #e4e9e4;padding-top:12px;display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:center}.control-row strong,.control-row small{display:block}.control-row strong{font-size:.72rem}.control-row small{margin-top:3px;color:#748078;font-size:.68rem}.control-row button{border:1px solid #b8c5ba;background:#fff;color:#47564b;border-radius:8px;padding:7px 9px;font-size:.7rem;cursor:pointer}
        h3{margin:0 0 8px;font-size:.8rem;color:#26342b}ul{margin:0;padding-left:18px;color:#4f5e54;font-size:.78rem;line-height:1.65}p{margin:9px 0 0;color:#748078;font-size:.7rem;line-height:1.5}
        @media(max-width:640px){.transparency-detail{grid-template-columns:1fr}.transparency-summary small{line-height:1.4}.control-row{grid-template-columns:1fr}}
      `}</style>
    </section>
  );
}

export default AssistantTransparencyPanel;
