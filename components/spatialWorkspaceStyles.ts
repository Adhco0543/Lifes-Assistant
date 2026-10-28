export const SPATIAL_WORKSPACE_CSS = `
.spatial-page {
          height: 100%;
          overflow-y: auto;
          overscroll-behavior-y: contain;
          background:
            radial-gradient(circle at 78% 2%, rgba(58, 132, 255, .10), transparent 25%),
            radial-gradient(circle at 12% 32%, rgba(79, 214, 172, .05), transparent 24%),
            #202020;
          color: #ececec;
        }
.spatial-page .spatial-inner {
          width: min(1320px, calc(100% - 40px));
          margin: 0 auto;
          padding: 34px 0 80px;
        }
.spatial-page .spatial-header {
          display: flex;
          justify-content: space-between;
          align-items: end;
          gap: 28px;
          margin-bottom: 18px;
        }
.spatial-page .kicker {
          color: #9bb4d0;
          font-size: .68rem;
          font-weight: 800;
          letter-spacing: .16em;
        }
.spatial-page h1 {
          margin: 8px 0 10px;
          font-size: clamp(2.2rem, 5vw, 4.4rem);
          line-height: .95;
          letter-spacing: -.055em;
          font-weight: 650;
        }
.spatial-page .spatial-header p,
.spatial-page .handoff-panel p {
          max-width: 720px;
          margin: 0;
          color: #aaa;
          line-height: 1.6;
          font-size: .9rem;
        }
.spatial-page .header-actions,
.spatial-page .viewer-toolbar,
.spatial-page .handoff-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
.spatial-page button,
.spatial-page .upload { font: inherit; }
.spatial-page button:focus-visible,
.spatial-page .upload:focus-within,
.spatial-page .scan-stage:focus-visible {
          outline: 2px solid #9cc8ff;
          outline-offset: 3px;
        }
.spatial-page button:disabled { opacity: .55; cursor: wait; }
.spatial-page .primary,
.spatial-page .ghost,
.spatial-page .tool-button,
.spatial-page .handoff-actions button {
          min-height: 42px;
          border-radius: 11px;
          padding: 0 14px;
          cursor: pointer;
        }
.spatial-page .primary {
          border: 0;
          background: #f0f0f0;
          color: #111;
          font-weight: 750;
        }
.spatial-page .ghost,
.spatial-page .tool-button,
.spatial-page .handoff-actions button {
          border: 1px solid #3b3b3b;
          background: #292929;
          color: #e8e8e8;
        }
.spatial-page .capability-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 12px;
        }
.spatial-page .cap {
          min-height: 54px;
          border: 1px solid #343434;
          background: #252525;
          border-radius: 13px;
          padding: 10px 12px;
          color: #aaa;
          font-size: .68rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 3px;
        }
.spatial-page .cap b { color: #b9b9b9; font-size: .72rem; }
.spatial-page .cap.ok { border-color: rgba(96, 214, 161, .24); }
.spatial-page .cap.ok b { color: #7dd8aa; }
.spatial-page .workspace-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.55fr) minmax(320px, .8fr);
          gap: 12px;
          align-items: start;
        }
.spatial-page .viewer-panel,
.spatial-page .inspector { min-width: 0; }
.spatial-page .viewer-panel,
.spatial-page .panel,
.spatial-page .handoff-panel,
.spatial-page .history-panel {
          border: 1px solid #343434;
          background: #242424;
          border-radius: 18px;
          box-shadow: 0 18px 50px rgba(0,0,0,.14);
        }
.spatial-page .viewer-panel { padding: 10px; }
.spatial-page .viewer-toolbar { padding: 2px 2px 10px; }
.spatial-page .tool-button {
          min-height: 44px;
          font-size: .72rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
.spatial-page .upload input { display: none; }
.spatial-page .upload.disabled { opacity: .5; cursor: not-allowed; }
.spatial-page .scan-stage {
          position: relative;
          width: 100%;
          min-width: 0;
          height: clamp(360px, 42vw, 560px);
          min-height: 0;
          aspect-ratio: auto;
          overflow: hidden;
          border-radius: 14px;
          border: 1px solid #3a3a3a;
          background:
            radial-gradient(circle at center, rgba(68, 125, 167, .14), transparent 42%),
            #111;
          cursor: crosshair;
          outline: none;
        }
.spatial-page .camera,
.spatial-page .photo {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
.spatial-page .camera { display: none; }
.spatial-page .camera.visible { display: block; }
.spatial-page .ar-canvas { visibility: hidden; position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.spatial-page .ar-canvas.visible { visibility: visible; }
.spatial-page .xr-dom-overlay { position: absolute; inset: 0; z-index: 2147483000; pointer-events: none; }
.spatial-page .ar-controls { position: absolute; left: 50%; bottom: max(16px, calc(env(safe-area-inset-bottom) + 8px)); max-height: calc(100% - 150px); overflow-y: auto; transform: translateX(-50%); display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; width: max-content; max-width: calc(100% - 20px); padding: 8px; border: 1px solid rgba(255,255,255,.22); border-radius: 14px; color: #fff; background: rgba(15,15,15,.82); backdrop-filter: blur(12px); pointer-events: auto; }
.spatial-page .ar-controls p { flex-basis: 100%; margin: 0 4px; text-align: center; font-size: .72rem; }
.spatial-page .ar-controls select { flex-basis: 100%; width: 100%; min-height: 44px; border: 1px solid #505b57; border-radius: 9px; padding: 0 10px; color: #fff; background: #252a28; font: inherit; font-size: .7rem; }
.spatial-page .ar-controls button { min-height: 44px; padding: 0 11px; border: 1px solid #5b6d62; border-radius: 9px; color: #eafff1; background: #254033; font: inherit; font-size: .7rem; font-weight: 750; white-space: nowrap; cursor: pointer; }
.spatial-page .ar-controls button:disabled { opacity: .48; cursor: wait; }
.spatial-page .ar-controls .end-ar-overlay { border-color: #555; color: #eee; background: #333; }
.spatial-page .scan-grid {
          pointer-events: none;
          position: absolute;
          inset: 0;
          opacity: .24;
          background-image:
            linear-gradient(rgba(116, 172, 218, .18) 1px, transparent 1px),
            linear-gradient(90deg, rgba(116, 172, 218, .18) 1px, transparent 1px);
          background-size: 8.333% 12.5%;
        }
.spatial-page .reticle {
          pointer-events: none;
          position: absolute;
          left: 50%;
          top: 50%;
          width: 70px;
          height: 70px;
          transform: translate(-50%, -50%);
          border: 1px solid rgba(255,255,255,.42);
          border-radius: 50%;
        }
.spatial-page .reticle::before,
.spatial-page .reticle::after {
          content: '';
          position: absolute;
          background: rgba(255,255,255,.42);
        }
.spatial-page .reticle::before { width: 100px; height: 1px; left: -16px; top: 34px; }
.spatial-page .reticle::after { width: 1px; height: 100px; left: 34px; top: -16px; }
.spatial-page .reticle span {
          position: absolute;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #fff;
          left: 31px;
          top: 31px;
          box-shadow: 0 0 0 5px rgba(255,255,255,.12);
        }
.spatial-page .empty-stage {
          position: absolute;
          inset: 0;
          display: grid;
          place-content: center;
          justify-items: center;
          text-align: center;
          gap: 8px;
          padding: 24px;
          color: #cfcfcf;
        }
.spatial-page .empty-stage small { color: #747474; }
.spatial-page .scan-cube {
          width: 84px;
          height: 84px;
          position: relative;
          margin-bottom: 10px;
          transform: rotateX(58deg) rotateZ(45deg);
          border: 1px solid rgba(127, 186, 233, .7);
          box-shadow: 0 0 40px rgba(71, 150, 213, .12);
        }
.spatial-page .scan-cube span {
          position: absolute;
          background: rgba(113, 178, 229, .5);
        }
.spatial-page .scan-cube span:nth-child(1) { width: 1px; height: 100%; left: 50%; }
.spatial-page .scan-cube span:nth-child(2) { height: 1px; width: 100%; top: 50%; }
.spatial-page .scan-cube span:nth-child(3) { inset: 15px; border: 1px solid rgba(113, 178, 229, .38); background: transparent; }
.spatial-page .pin {
          position: absolute;
          transform: translate(-50%, -50%);
          width: 30px;
          height: 30px;
          border-radius: 50% 50% 50% 8px;
          border: 2px solid rgba(255,255,255,.8);
          color: #111;
          font-weight: 850;
          cursor: pointer;
          rotate: -45deg;
          box-shadow: 0 6px 20px rgba(0,0,0,.34);
        }
.spatial-page .pin::first-letter { rotate: 45deg; }
.spatial-page .pin-work { background: #9cc8ff; }
.spatial-page .pin-damage { background: #ff9b9b; }
.spatial-page .pin-material { background: #9fe0ba; }
.spatial-page .pin-idea { background: #e7ca83; }
.spatial-page .stage-status {
          position: absolute;
          left: 12px;
          bottom: 12px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 9px;
          border-radius: 9px;
          background: rgba(15,15,15,.72);
          border: 1px solid rgba(255,255,255,.12);
          backdrop-filter: blur(10px);
          font-size: .58rem;
          font-weight: 800;
          letter-spacing: .1em;
        }
.spatial-page .live-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #777;
        }
.spatial-page .live-dot.active {
          background: #6dd49d;
          box-shadow: 0 0 0 4px rgba(109,212,157,.12);
        }
.spatial-page .accuracy-note {
          padding: 11px 5px 2px;
          color: #999;
          font-size: .68rem;
          line-height: 1.55;
        }
.spatial-page .accuracy-note b { color: #a5a5a5; }
.spatial-page .inspector {
          display: grid;
          gap: 10px;
        }
.spatial-page .panel { padding: 15px; }
.spatial-page .panel-title {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
          margin-bottom: 12px;
        }
.spatial-page .panel-title span {
          color: #6e8296;
          font-size: .58rem;
          letter-spacing: .14em;
          font-weight: 800;
        }
.spatial-page .panel-title strong { font-size: .86rem; }
.spatial-page label {
          display: grid;
          gap: 5px;
          color: #aaa;
          font-size: .66rem;
          margin-top: 9px;
        }
.spatial-page input,
.spatial-page select,
.spatial-page textarea {
          width: 100%;
          border: 1px solid #3a3a3a;
          background: #1e1e1e;
          color: #eaeaea;
          border-radius: 10px;
          padding: 10px 11px;
          outline: 0;
        }
.spatial-page textarea {
          min-height: 80px;
          resize: vertical;
        }
.spatial-page input:focus,
.spatial-page select:focus,
.spatial-page textarea:focus {
          border-color: #617c96;
          box-shadow: 0 0 0 3px rgba(97,124,150,.12);
        }
.spatial-page .field-grid,
.spatial-page .dimension-row {
          display: grid;
          gap: 8px;
        }
.spatial-page .field-grid { grid-template-columns: 1fr 1fr; }
.spatial-page .dimension-row {
          grid-template-columns: 1fr 1fr auto;
          align-items: end;
        }
.spatial-page .add-button {
          min-height: 44px;
          border: 0;
          border-radius: 10px;
          background: #e9e9e9;
          color: #111;
          font-weight: 800;
          padding: 0 13px;
          cursor: pointer;
        }
.spatial-page .ar-step-hint { display: block; margin-top: 8px; color: #c9b77e; font-size: .61rem; line-height: 1.4; }
.spatial-page .measurement-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 12px;
        }
.spatial-page .measurement-chip {
          border: 1px solid #3a3a3a;
          background: #2b2b2b;
          color: #aaa;
          border-radius: 9px;
          padding: 7px 9px;
          cursor: pointer;
          text-align: left;
        }
.spatial-page .measurement-chip span,
.spatial-page .measurement-chip b { display: block; }
.spatial-page .measurement-chip span { font-size: .58rem; }
.spatial-page .measurement-chip b { margin-top: 2px; color: #e6e6e6; font-size: .69rem; }
.spatial-page .empty-copy,
.spatial-page .tap-hint {
          display: block;
          color: #999;
          font-size: .62rem;
          margin-top: 9px;
        }
.spatial-page .metrics {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 7px;
          margin-top: 12px;
        }
.spatial-page .metrics div {
          border: 1px solid #343434;
          background: #202020;
          border-radius: 10px;
          padding: 9px;
        }
.spatial-page .metrics span,
.spatial-page .metrics b { display: block; }
.spatial-page .metrics span { color: #999; font-size: .58rem; }
.spatial-page .metrics b { color: #d9d9d9; margin-top: 3px; font-size: .76rem; }
.spatial-page .ar-warning { margin: 9px 0 0; color: #e5c681; font-size: .64rem; line-height: 1.45; }
.spatial-page .layout-copy { margin: -3px 0 10px; color: #929292; font-size: .64rem; line-height: 1.5; }
.spatial-page .layout-empty { border: 1px dashed #414141; border-radius: 11px; padding: 14px; color: #9d9d9d; font-size: .68rem; line-height: 1.5; }
.spatial-page .plan-measurements { display: flex; justify-content: space-between; gap: 10px; margin: 8px 0 7px; color: #909090; font-size: .58rem; }
.spatial-page .plan-measurements span { display: grid; gap: 2px; }
.spatial-page .plan-measurements span:last-child { text-align: right; }
.spatial-page .plan-measurements b { color: #d8e3eb; font-size: .67rem; }
.spatial-page .plan-wrap { display: flex; justify-content: center; overflow: hidden; padding: 4px 0; }
.spatial-page .room-plan {
          position: relative;
          flex: 0 0 auto;
          overflow: hidden;
          border: 2px solid #a9bdcc;
          border-radius: 4px;
          background: #1c2327;
          box-shadow: 0 0 0 5px rgba(148, 179, 202, .06), inset 0 0 20px rgba(97, 137, 160, .08);
          cursor: default;
          outline: none;
          touch-action: manipulation;
        }
.spatial-page .room-plan:focus-visible { outline: 2px solid #9cc8ff; outline-offset: 4px; }
.spatial-page .room-plan.placing { border-color: #80ddb1; cursor: crosshair; box-shadow: 0 0 0 5px rgba(96, 214, 161, .13); }
.spatial-page .room-plan-grid { position: absolute; inset: 0; pointer-events: none; opacity: .5; background-image: linear-gradient(rgba(132, 167, 186, .14) 1px, transparent 1px), linear-gradient(90deg, rgba(132, 167, 186, .14) 1px, transparent 1px); background-size: 12.5% 12.5%; }
.spatial-page .room-item {
          position: absolute;
          z-index: 1;
          min-width: min(34px, 100%);
          min-height: 24px;
          display: grid;
          place-items: center;
          padding: 2px 4px;
          overflow: hidden;
          border: 1px solid rgba(238, 246, 250, .66);
          border-radius: 5px;
          color: #eff7f9;
          background: rgba(74, 137, 149, .78);
          box-shadow: 0 3px 8px rgba(0,0,0,.22);
          font-size: .54rem;
          line-height: 1.15;
          text-align: center;
          text-overflow: ellipsis;
          cursor: pointer;
        }
.spatial-page .room-item:hover { filter: brightness(1.22); }
.spatial-page .room-item-cabinet { background: rgba(111, 128, 172, .86); }
.spatial-page .room-item-appliance { background: rgba(112, 139, 154, .9); }
.spatial-page .room-item-fixture { background: rgba(56, 143, 127, .88); }
.spatial-page .room-item-furniture { background: rgba(160, 124, 84, .88); }
.spatial-page .room-item-opening { background: rgba(157, 100, 110, .9); }
.spatial-page .placement-actions { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.spatial-page .placement-actions .add-button { flex: 1; }
.spatial-page .cancel-place { min-height: 44px; padding: 0 12px; border: 1px solid #414141; border-radius: 10px; color: #ddd; background: #2d2d2d; cursor: pointer; }
.spatial-page .item-size-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
.spatial-page .plan-hint { margin: 7px 0 0; color: #9ac8b2; font-size: .61rem; line-height: 1.45; }
.spatial-page .room-item-list { display: grid; gap: 5px; margin: 10px 0 0; padding: 0; list-style: none; }
.spatial-page .room-item-list li { display: flex; align-items: center; justify-content: space-between; gap: 8px; border-top: 1px solid #303030; padding-top: 7px; }
.spatial-page .room-item-list li > span { min-width: 0; display: grid; gap: 2px; }
.spatial-page .room-item-list b { overflow: hidden; color: #d7d7d7; font-size: .65rem; text-overflow: ellipsis; white-space: nowrap; }
.spatial-page .room-item-list small { color: #8f8f8f; font-size: .58rem; }
.spatial-page .room-item-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 5px; }
.spatial-page .room-item-list button { border: 0; color: #f0a9a9; background: transparent; font-size: .61rem; cursor: pointer; }
.spatial-page .room-item-list .room-item-actions button:first-child { color: #9cc8ff; }
.spatial-page .note-list {
          display: grid;
          gap: 6px;
          margin-top: 10px;
        }
.spatial-page .note-row {
          display: grid;
          grid-template-columns: 25px 1fr;
          gap: 8px;
          border-top: 1px solid #303030;
          padding-top: 8px;
        }
.spatial-page .note-row > span {
          width: 23px;
          height: 23px;
          border-radius: 7px;
          display: grid;
          place-items: center;
          background: #333;
          color: #bcbcbc;
          font-size: .64rem;
        }
.spatial-page .note-row b {
          text-transform: uppercase;
          color: #999;
          font-size: .54rem;
          letter-spacing: .08em;
        }
.spatial-page .note-row p {
          margin: 2px 0 0;
          color: #b7b7b7;
          font-size: .65rem;
          line-height: 1.4;
        }
.spatial-page .handoff-panel {
          margin-top: 12px;
          padding: 18px;
          display: flex;
          justify-content: space-between;
          gap: 22px;
          align-items: center;
        }
.spatial-page .handoff-panel h2,
.spatial-page .history-panel h2 {
          margin: 4px 0 5px;
          font-size: 1.05rem;
        }
.spatial-page .handoff-actions button {
          min-width: 136px;
          font-size: .72rem;
          font-weight: 700;
        }
.spatial-page .handoff-actions button span { margin-right: 6px; }
.spatial-page .history-panel {
          margin-top: 12px;
          padding: 18px;
        }
.spatial-page .history-heading {
          display: flex;
          justify-content: space-between;
          align-items: end;
          gap: 20px;
          margin-bottom: 12px;
        }
.spatial-page .status-text { color: #aaa; font-size: .68rem; }
.spatial-page .history-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0,1fr));
          gap: 8px;
        }
.spatial-page .history-card,
.spatial-page .history-empty {
          min-height: 100px;
          border: 1px solid #353535;
          background: #292929;
          border-radius: 12px;
          padding: 12px;
          color: #ddd;
          text-align: left;
        }
.spatial-page .history-card { cursor: pointer; }
.spatial-page .history-card:hover { border-color: #4a4a4a; background: #2d2d2d; }
.spatial-page .history-card span,
.spatial-page .history-card strong,
.spatial-page .history-card small { display: block; }
.spatial-page .history-card span { color: #687b8f; font-size: .54rem; letter-spacing: .12em; }
.spatial-page .history-card strong { margin-top: 8px; font-size: .78rem; }
.spatial-page .history-card small { margin-top: 8px; color: #999; font-size: .6rem; }
.spatial-page .history-empty {
          grid-column: 1 / -1;
          color: #686868;
          display: grid;
          place-items: center;
        }
@media (max-width: 1050px) {
.spatial-page .workspace-grid { grid-template-columns: 1fr; }
.spatial-page .scan-stage { height: clamp(440px, 58vw, 720px); }
.spatial-page .capability-row { grid-template-columns: repeat(2, 1fr); }
.spatial-page .history-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 680px) {
.spatial-page .spatial-inner {
            width: min(100% - 24px, 1320px);
            padding-top: 22px;
            padding-bottom: calc(110px + env(safe-area-inset-bottom));
          }
.spatial-page .spatial-header,
.spatial-page .handoff-panel,
.spatial-page .history-heading {
            align-items: stretch;
            flex-direction: column;
          }
.spatial-page .header-actions,
.spatial-page .handoff-actions { width: 100%; }
.spatial-page .header-actions > *,
.spatial-page .handoff-actions > * { flex: 1; }
.spatial-page .capability-row,
.spatial-page .history-grid,
.spatial-page .field-grid { grid-template-columns: 1fr; }
.spatial-page .scan-stage { height: clamp(360px, 58vh, 620px); }
.spatial-page .dimension-row { grid-template-columns: 1fr 1fr; }
.spatial-page .add-button { grid-column: 1 / -1; }
.spatial-page h1 { font-size: 2.5rem; }
}

.spatial-page .ar-exit-button {
  position: absolute;
  top: max(12px, env(safe-area-inset-top));
  right: max(12px, env(safe-area-inset-right));
  z-index: 2147483000;
  min-width: 120px;
  min-height: 52px;
  padding: 0 20px;
  border: 2px solid #fff;
  border-radius: 14px;
  color: #fff;
  background: #b3261e;
  font: inherit;
  font-size: 1rem;
  font-weight: 800;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 8px 24px rgba(0,0,0,.5);
}
.spatial-page .ar-exit-hint {
  position: absolute;
  top: max(12px, env(safe-area-inset-top));
  left: max(12px, env(safe-area-inset-left));
  max-width: calc(100% - 190px - env(safe-area-inset-left));
  margin: 0;
  padding: 7px 10px;
  border-radius: 10px;
  color: #fff;
  background: rgba(15,15,15,.78);
  font-size: .66rem;
  line-height: 1.4;
  pointer-events: none;
}
.spatial-page .ar-controls .ar-note { font-size: .64rem; color: #f3dfa6; }
.spatial-page .scan-flow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 10px;
  border: 1px solid #3f5a4a;
  border-radius: 12px;
  background: #1f2b25;
  color: #d9f2e3;
}
.spatial-page .scan-flow.in-overlay { margin: 0; flex-basis: 100%; justify-content: center; border-color: rgba(255,255,255,.2); background: transparent; padding: 0; }
.spatial-page .scan-flow-text { flex: 1 1 220px; margin: 0; font-size: .72rem; line-height: 1.4; }
.spatial-page .scan-flow-text b { display: block; font-size: .78rem; }
.spatial-page .scan-flow button,
.spatial-page .capture-notice button {
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid #5b6d62;
  border-radius: 10px;
  color: #eafff1;
  background: #254033;
  font: inherit;
  font-size: .72rem;
  font-weight: 700;
  cursor: pointer;
}
.spatial-page .scan-flow button:disabled { opacity: .45; cursor: not-allowed; }
.spatial-page .capture-notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 10px;
  border: 1px solid #6b5d34;
  border-radius: 12px;
  background: #2b2616;
  color: #f3dfa6;
  font-size: .68rem;
  line-height: 1.45;
}
.spatial-page .capture-notice p { flex: 1 1 220px; margin: 0; }
.spatial-page .ar-hint-banner { margin: 0 0 8px; color: #c9b77e; font-size: .64rem; line-height: 1.45; }
.spatial-page .tool-button.primary-tool { border-color: #5b8f74; background: #254033; color: #eafff1; font-weight: 750; }
.spatial-page .ar-controls button,
.spatial-page .add-button,
.spatial-page .cancel-place { min-height: 44px; }
.spatial-page .room-item-actions button { min-height: 44px; min-width: 44px; }
@media (max-width: 680px) {
  .spatial-page .viewer-toolbar { display: grid; grid-template-columns: 1fr 1fr; }
  .spatial-page .viewer-toolbar .tool-button { min-height: 48px; font-size: .8rem; }
  .spatial-page .viewer-toolbar .primary-tool { order: -1; }
}
`;
