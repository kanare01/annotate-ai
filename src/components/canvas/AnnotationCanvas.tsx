import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Transformer, Line, Group, Text } from 'react-konva';
import useImage from 'use-image';
import { useAnnotationStore } from '../../store/useAnnotationStore';
import { Annotation, AnnotationType } from '../../types';

import { MousePointer2, Square, Pentagon, Target, Undo2, Redo2, Sparkles, Trash2, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  imageUrl: string;
  width: number;
  height: number;
  onAutoAnnotate: () => void;
  onAddAnnotation: (annotation: Omit<Annotation, 'id'>) => void;
  onUpdateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  onDeleteAnnotation: (id: string) => void;
}

export const AnnotationCanvas: React.FC<Props> = ({ 
  imageUrl, 
  width, 
  height, 
  onAutoAnnotate,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation
}) => {
  const [image] = useImage(imageUrl);
  const { annotations, selectedId, tool, setTool, addAnnotation, updateAnnotation, setSelectedId, undo, redo } = useAnnotationStore();
  const [newAnnotation, setNewAnnotation] = useState<number[] | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const stageRef = useRef<any>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId && trRef.current && shapeRef.current) {
      const selectedNode = shapeRef.current.findOne((node: any) => node.id() === selectedId);
      if (selectedNode && selectedNode.className === 'Rect') {
        trRef.current.nodes([selectedNode]);
        trRef.current.getLayer().batchDraw();
      } else {
        trRef.current.nodes([]);
      }
    } else if (trRef.current) {
      trRef.current.nodes([]);
    }
  }, [selectedId, annotations]);

  const tools: { id: AnnotationType | 'select'; icon: any; label: string }[] = [
    { id: 'select', icon: MousePointer2, label: 'Select' },
    { id: 'bbox', icon: Square, label: 'Bounding Box' },
    { id: 'polygon', icon: Pentagon, label: 'Polygon' },
    { id: 'keypoint', icon: Target, label: 'Keypoint' },
  ];

  // Handle Zoom with Mouse Wheel
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();

    const mousePointTo = {
      x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
      y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;

    setScale(newScale);
    setPosition({
      x: -(mousePointTo.x - stage.getPointerPosition().x / newScale) * newScale,
      y: -(mousePointTo.y - stage.getPointerPosition().y / newScale) * newScale,
    });
  };

  const finalizePolygon = (points: number[]) => {
    if (points.length < 4) return;
    onAddAnnotation({
      type: 'polygon',
      label: 'new polygon',
      points: points,
      color: '#10b981'
    });
    setNewAnnotation(null);
  };

  const handleMouseDown = (e: any) => {
    // Pan with middle mouse button or space + left click
    if (e.evt.button === 1 || (e.evt.button === 0 && e.evt.shiftKey)) {
      stageRef.current.container().style.cursor = 'grabbing';
      return;
    }

    if (tool === 'select') {
      const clickedOnEmpty = e.target === e.target.getStage();
      if (clickedOnEmpty) {
        setSelectedId(null);
      }
      return;
    }

    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    const pos = {
      x: (pointer.x - stage.x()) / stage.scaleX(),
      y: (pointer.y - stage.y()) / stage.scaleY(),
    };

    if (tool === 'bbox') {
      setNewAnnotation([pos.x, pos.y, 0, 0]);
    } else if (tool === 'polygon') {
      if (!newAnnotation) {
        setNewAnnotation([pos.x, pos.y]);
      } else {
        // Check if clicking near the first point to close
        const firstX = newAnnotation[0];
        const firstY = newAnnotation[1];
        const dist = Math.sqrt(Math.pow(pos.x - firstX, 2) + Math.pow(pos.y - firstY, 2));
        
        if (dist < 10 / scale && newAnnotation.length >= 4) {
          finalizePolygon(newAnnotation);
        } else {
          setNewAnnotation([...newAnnotation, pos.x, pos.y]);
        }
      }
    }
  };

  const handleMouseMove = (e: any) => {
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    const pos = {
      x: (pointer.x - stage.x()) / stage.scaleX(),
      y: (pointer.y - stage.y()) / stage.scaleY(),
    };
    setMousePos(pos);

    if (!newAnnotation || tool === 'select') return;

    if (tool === 'bbox') {
      const startX = newAnnotation[0];
      const startY = newAnnotation[1];
      setNewAnnotation([startX, startY, pos.x - startX, pos.y - startY]);
    }
  };

  const handleMouseUp = (e: any) => {
    stageRef.current.container().style.cursor = 'default';
    if (!newAnnotation) return;

    if (tool === 'bbox') {
      onAddAnnotation({
        type: 'bbox',
        label: 'new object',
        points: newAnnotation,
        color: '#3b82f6'
      });
      setNewAnnotation(null);
    }
  };

  const handleDblClick = () => {
    if (tool === 'polygon' && newAnnotation) {
      finalizePolygon(newAnnotation);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <div className="bg-neutral-900 rounded-xl overflow-hidden shadow-2xl border border-white/10 relative group">
      <Stage
        width={width}
        height={height}
        scaleX={scale}
        scaleY={scale}
        x={position.x}
        y={position.y}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDblClick={handleDblClick}
        draggable={tool === 'select'}
        ref={stageRef}
      >
        <Layer ref={shapeRef}>
          {image && (
            <KonvaImage
              image={image}
              width={width}
              height={height}
            />
          )}
          {annotations.map((ann) => (
            <React.Fragment key={ann.id}>
              {ann.type === 'bbox' && (
                <Rect
                  id={ann.id}
                  x={ann.points[0]}
                  y={ann.points[1]}
                  width={ann.points[2]}
                  height={ann.points[3]}
                  stroke={ann.color || '#3b82f6'}
                  strokeWidth={selectedId === ann.id ? 3 / scale : 2 / scale}
                  fill={(ann.color || '#3b82f6') + (selectedId === ann.id ? '55' : '33')}
                  draggable={tool === 'select'}
                  onClick={() => setSelectedId(ann.id)}
                  onMouseEnter={() => setHoveredId(ann.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onDragEnd={(e) => {
                    onUpdateAnnotation(ann.id, {
                      points: [e.target.x(), e.target.y(), ann.points[2], ann.points[3]]
                    });
                  }}
                  onTransformEnd={(e) => {
                    const node = e.target;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    node.scaleX(1);
                    node.scaleY(1);
                    onUpdateAnnotation(ann.id, {
                      points: [
                        node.x(),
                        node.y(),
                        Math.max(5, node.width() * scaleX),
                        Math.max(5, node.height() * scaleY),
                      ],
                    });
                  }}
                />
              )}
              {ann.type === 'polygon' && (
                <Line
                  id={ann.id}
                  points={ann.points}
                  stroke={ann.color || '#10b981'}
                  strokeWidth={selectedId === ann.id ? 3 / scale : 2 / scale}
                  fill={(ann.color || '#10b981') + (selectedId === ann.id ? '55' : '33')}
                  closed={true}
                  draggable={tool === 'select'}
                  onClick={() => setSelectedId(ann.id)}
                  onDragEnd={(e) => {
                    const dx = e.target.x();
                    const dy = e.target.y();
                    const newPoints = ann.points.map((p, i) => i % 2 === 0 ? p + dx : p + dy);
                    onUpdateAnnotation(ann.id, { points: newPoints });
                    e.target.position({ x: 0, y: 0 });
                  }}
                />
              )}
            </React.Fragment>
          ))}
          {selectedId && tool === 'select' && (
            <Transformer
              ref={trRef}
              rotateEnabled={false}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 5 || newBox.height < 5) {
                  return oldBox;
                }
                return newBox;
              }}
              anchorSize={8 / scale}
              anchorStroke="#fff"
              anchorFill="#3b82f6"
              borderStroke="#3b82f6"
            />
          )}
          {newAnnotation && tool === 'bbox' && (
            <Rect
              x={newAnnotation[0]}
              y={newAnnotation[1]}
              width={newAnnotation[2]}
              height={newAnnotation[3]}
              stroke="#3b82f6"
              strokeWidth={2 / scale}
              dash={[5 / scale, 5 / scale]}
            />
          )}
          {newAnnotation && tool === 'polygon' && (
            <Line
              points={[...newAnnotation, mousePos.x, mousePos.y]}
              stroke="#10b981"
              strokeWidth={2 / scale}
              dash={[5 / scale, 5 / scale]}
              closed={false}
            />
          )}
          {hoveredId && (
            (() => {
              const ann = annotations.find(a => a.id === hoveredId);
              if (!ann || ann.type !== 'bbox') return null;
              
              const fontSize = 12 / scale;
              const padding = 6 / scale;
              const x = ann.points[0];
              const y = ann.points[1] - fontSize - padding * 2 - (5 / scale);
              
              return (
                <Group x={x} y={y}>
                  <Rect
                    fill={ann.color || '#3b82f6'}
                    height={fontSize + padding * 2}
                    width={ann.label.length * (fontSize * 0.7) + padding * 2}
                    cornerRadius={4 / scale}
                    shadowBlur={10 / scale}
                    shadowColor="black"
                    shadowOpacity={0.3}
                  />
                  <Text
                    text={ann.label}
                    fill="#fff"
                    fontSize={fontSize}
                    padding={padding}
                    fontStyle="bold"
                  />
                </Group>
              );
            })()
          )}
        </Layer>
      </Stage>
      
      {/* Zoom Controls Overlay */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={() => setScale(s => s * 1.2)}
          className="w-8 h-8 bg-neutral-800 border border-white/10 rounded-lg flex items-center justify-center hover:bg-neutral-700 transition-colors"
        >
          +
        </button>
        <button 
          onClick={() => setScale(s => s / 1.2)}
          className="w-8 h-8 bg-neutral-800 border border-white/10 rounded-lg flex items-center justify-center hover:bg-neutral-700 transition-colors"
        >
          -
        </button>
        <button 
          onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }}
          className="w-8 h-8 bg-neutral-800 border border-white/10 rounded-lg flex items-center justify-center hover:bg-neutral-700 transition-colors text-[10px]"
        >
          Reset
        </button>
      </div>
    </div>
  );
};
