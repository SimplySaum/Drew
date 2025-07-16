import React, { useEffect, useRef, useState } from "react";
import { Stage, Layer, Line, Text, Transformer } from "react-konva";
import "./CanvasBoard.css";
import Toolbar from "./Toolbar";
import io from "socket.io-client";

const socket = io("https://drew-l90n.onrender.com");  

function CanvasBoard() {
  const stageRef = useRef();
  const layerRef = useRef();
  const trRef = useRef();

  const [pen, setPen] = useState({ color: "#000000", width: 4, opacity: 1 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isEraser, setIsEraser] = useState(false);
  const [stylusOnly, setStylusOnly] = useState(false);
  const [texts, setTexts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editingTextId, setEditingTextId] = useState(null);
  const [editingTextValue, setEditingTextValue] = useState("");
  const [editingPosition, setEditingPosition] = useState({});
  const [smoothingWindow, setSmoothingWindow] = useState(4);
  const [bezierTension, setBezierTension] = useState(0.5);
  const [roomId, setRoomId] = useState("");
  const [myRoomId, setMyRoomId] = useState("");

  const linesRef = useRef([]);
  const historyRef = useRef([]);
  const isDrawing = useRef(false);
  const currentLine = useRef(null);
  const smoothingBuffer = useRef([]);

  const socketRef = useRef();

  useEffect(() => {
    socketRef.current = io("http://localhost:3000");

    socketRef.current.on("connect", () => {
      console.log("Connected to server:", socketRef.current.id);
    });

    socketRef.current.on("room-created", (id) => {
      setRoomId(id);
      setMyRoomId(id);
      console.log("Room created with ID:", id);
    });

    socketRef.current.on("room-joined", (id) => {
      setRoomId(id);
      console.log("Joined room with ID:", id);
    });

    socketRef.current.on("drawing", (data) => {
      const newLine = window.Konva.Node.create(data);
      layerRef.current.add(newLine);
      layerRef.current.batchDraw();
    });

    socketRef.current.on("add-text", (data) => {
      setTexts(data);
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        setIsSpacePressed(e.type === "keydown");
      }
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKey);
    };
  }, []);

  useEffect(() => {
    if (trRef.current && selectedId) {
      const selectedNode = layerRef.current.findOne(`#${selectedId}`);
      if (selectedNode) {
        trRef.current.nodes([selectedNode]);
        trRef.current.getLayer().batchDraw();
      }
    } else {
      trRef.current?.detach();
      layerRef.current.batchDraw();
    }
  }, [selectedId]);

  const handlePointerDown = (e) => {
    if (editingTextId) return;
    if (isSpacePressed) return;
    if (stylusOnly && e.evt.pointerType !== "pen") return;

    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) {
      setSelectedId(null);
    }

    if (e.target.attrs.id?.startsWith("text-")) {
      setSelectedId(e.target.attrs.id);
      return;
    }

    isDrawing.current = true;
    const pos = stageRef.current.getRelativePointerPosition();
    smoothingBuffer.current = [pos];

    const line = new window.Konva.Line({
      points: [pos.x, pos.y],
      stroke: pen.color,
      strokeWidth: pen.width,
      opacity: pen.opacity,
      lineCap: "round",
      globalCompositeOperation: isEraser ? "destination-out" : "source-over",
      bezier: true,
      tension: bezierTension,
      lineJoin: "round",
    });

    layerRef.current.add(line);
    currentLine.current = line;
    layerRef.current.batchDraw();
  };

  const handlePointerMove = (e) => {
    if (!isDrawing.current) return;
    if (stylusOnly && e.evt.pointerType !== "pen") return;

    const pos = stageRef.current.getRelativePointerPosition();
    smoothingBuffer.current.push(pos);
    if (smoothingBuffer.current.length > smoothingWindow) {
      smoothingBuffer.current.shift();
    }

    const averaged = smoothingBuffer.current.reduce(
      (acc, point) => {
        acc.x += point.x;
        acc.y += point.y;
        return acc;
      },
      { x: 0, y: 0 }
    );
    averaged.x /= smoothingBuffer.current.length;
    averaged.y /= smoothingBuffer.current.length;

    const line = currentLine.current;
    if (!line) return;
    line.points([...line.points(), averaged.x, averaged.y]);
    layerRef.current.batchDraw();
  };

  const handlePointerUp = () => {
    if (currentLine.current) {
      linesRef.current.push(currentLine.current.toJSON());
      historyRef.current = [...linesRef.current];
      socketRef.current.emit("drawing", { roomId, data: currentLine.current.toJSON() });
    }
    isDrawing.current = false;
    currentLine.current = null;
  };


  const handleWheel = (e) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    const stage = stageRef.current;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    const direction = e.evt.deltaY > 0 ? 1 : -1;
    let newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    newScale = Math.max(0.2, Math.min(4, newScale));
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    stage.scale({ x: newScale, y: newScale });
    stage.position({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
    setZoomLevel(newScale);
    stage.batchDraw();
  };

  const addTextBox = () => {
    const id = `text-${Date.now()}`;
    const newTexts = [...texts, { id, text: "New Text", x: 150, y: 150 }];
    setTexts(newTexts);
    setSelectedId(id);
    socketRef.current.emit("add-text", { roomId, data: newTexts });
  };

  const handleTextChangeAttrs = (id, newAttrs) => {
    const newTexts = texts.map((txt) => (txt.id === id ? { ...txt, ...newAttrs } : txt));
    setTexts(newTexts);
    socketRef.current.emit("add-text", { roomId, data: newTexts });
  };

  const handleDoubleClick = (item) => {
    const stage = stageRef.current;
    const textNode = stage.findOne(`#${item.id}`);
    const absPos = textNode.absolutePosition();
    const scale = stage.scaleX();

    setEditingTextId(item.id);
    setEditingTextValue(item.text);

    setEditingPosition({
      left: absPos.x * scale + stage.container().offsetLeft,
      top: absPos.y * scale + stage.container().offsetTop,
      width: textNode.width() * scale,
      height: textNode.height() * scale,
      fontSize: textNode.fontSize() * scale,
    });
  };

  const handleTextSubmit = () => {
    if (editingTextId) {
      handleTextChangeAttrs(editingTextId, { text: editingTextValue });
      setEditingTextId(null);
    }
  };

  return (
    <div className={`canvas-wrapper ${stylusOnly ? "stylus-mode" : ""}`}>
      <div className="room-controls">
        <button onClick={() => socketRef.current.emit("create-room")}>Create Room</button>
        <button
          onClick={() => {
            const id = prompt("Enter Room ID:");
            if (id) socketRef.current.emit("join-room", id);
          }}
        >
          Join Room
        </button>
        {myRoomId && <div className="room-id">Your Room ID: {myRoomId}</div>}
      </div>
      <Stage
        width={window.innerWidth}
        height={window.innerHeight}
        ref={stageRef}
        draggable={isSpacePressed}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        className="canvas-stage"
        style={{ cursor: isSpacePressed ? "grab" : "crosshair" }}
      >
        <Layer ref={layerRef}>
          {texts.map((item) =>
            editingTextId === item.id ? null : (
              <Text
                key={item.id}
                id={item.id}
                text={item.text}
                x={item.x}
                y={item.y}
                fontSize={24}
                draggable
                onTransformEnd={(e) => {
                  const node = e.target;
                  handleTextChangeAttrs(item.id, {
                    x: node.x(),
                    y: node.y(),
                    rotation: node.rotation(),
                    scaleX: node.scaleX(),
                    scaleY: node.scaleY(),
                  });
                }}
                onDragEnd={(e) => {
                  handleTextChangeAttrs(item.id, {
                    x: e.target.x(),
                    y: e.target.y(),
                  });
                }}
                onClick={() => setSelectedId(item.id)}
                onDblClick={() => handleDoubleClick(item)}
              />
            )
          )}
          <Transformer ref={trRef} />
        </Layer>
      </Stage>

      {editingTextId && (
        <textarea
          className="canvas-textarea"
          style={editingPosition}
          value={editingTextValue}
          onChange={(e) => setEditingTextValue(e.target.value)}
          onBlur={handleTextSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleTextSubmit();
            }
          }}
          autoFocus
        />
      )}

      <Toolbar
        pen={pen}
        setPen={setPen}
        isEraser={isEraser}
        setIsEraser={setIsEraser}
        stylusOnly={stylusOnly}
        setStylusOnly={setStylusOnly}
        smoothingWindow={smoothingWindow}
        setSmoothingWindow={setSmoothingWindow}
        bezierTension={bezierTension}
        setBezierTension={setBezierTension}
        
        onAddTextBox={addTextBox}
      />

      <div className="zoom-indicator">Zoom: {(zoomLevel * 100).toFixed(0)}%</div>
    </div>
  );
}

export default CanvasBoard;