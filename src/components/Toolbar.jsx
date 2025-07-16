import React from "react";

function Toolbar({
  pen,
  setPen,
  smoothingWindow,
  setSmoothingWindow,
  bezierTension,
  setBezierTension,
  isEraser,
  setIsEraser,
  stylusOnly,
  setStylusOnly,
  onAddTextBox,      // Use onAddTextBox here
  onUndo,            // Consistent naming
}) {
  return (
    <div className="canvas-toolbar">
      <button className="toolbar-button" onClick={onAddTextBox}>Add Text</button>

      <label>
        Pen Color
        <input
          className="toolbar-button"
          type="color"
          value={pen.color}
          onChange={(e) => setPen({ ...pen, color: e.target.value })}
        />
      </label>

      <label>
        Pen Width
        <input
          className="toolbar-button"
          type="range"
          min={1}
          max={20}
          value={pen.width}
          onChange={(e) => setPen({ ...pen, width: parseInt(e.target.value) })}
        />
      </label>

      <label>
        Transparency
        <input
          className="toolbar-button"
          type="range"
          min={0.1}
          max={1}
          step={0.1}
          value={pen.opacity}
          onChange={(e) => setPen({ ...pen, opacity: parseFloat(e.target.value) })}
        />
      </label>

      <label>
        Smoothing Window
        <input
          className="toolbar-button"
          type="range"
          min={2}
          max={20}
          value={smoothingWindow}
          onChange={(e) => setSmoothingWindow(parseInt(e.target.value))}
        />
      </label>

      <label>
        Bezier Tension
        <input
          className="toolbar-button"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={bezierTension}
          onChange={(e) => setBezierTension(parseFloat(e.target.value))}
        />
      </label>

      <button
        className="toolbar-button"
        onClick={() => setIsEraser(!isEraser)}
      >
        {isEraser ? "Switch to Pen" : "Switch to Eraser"}
      </button>

      <label>
        Stylus Only
        <input
          className="toolbar-button"
          type="checkbox"
          checked={stylusOnly}
          onChange={(e) => setStylusOnly(e.target.checked)}
        />
      </label>
    </div>
  );
}

export default Toolbar;
