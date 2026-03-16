import React, { useState, useEffect } from 'react';
import { useAnnotationStore } from '../store/useAnnotationStore';
import { Annotation } from '../types';
import { Trash2, Tag, Palette, Hash, Move, Maximize } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  onUpdate: (id: string, updates: Partial<Annotation>) => void;
  onDelete: (id: string) => void;
}

export const PropertyPanel: React.FC<Props> = ({ onUpdate, onDelete }) => {
  const { annotations, selectedId, setSelectedId } = useAnnotationStore();
  const selectedAnnotation = annotations.find(a => a.id === selectedId);
  
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('');

  useEffect(() => {
    if (selectedAnnotation) {
      setLabel(selectedAnnotation.label);
      setColor(selectedAnnotation.color || '#3b82f6');
    }
  }, [selectedAnnotation]);

  if (!selectedAnnotation) {
    return (
      <div className="w-72 bg-neutral-900 border-l border-white/10 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <Hash className="text-neutral-600" size={24} />
        </div>
        <h3 className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest">No Selection</h3>
        <p className="text-[10px] text-neutral-600 mt-2">Select an annotation on the canvas to edit its properties.</p>
      </div>
    );
  }

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newLabel = e.target.value;
    setLabel(newLabel);
    onUpdate(selectedAnnotation.id, { label: newLabel });
  };

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    onUpdate(selectedAnnotation.id, { color: newColor });
  };

  const handlePointChange = (index: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    const newPoints = [...selectedAnnotation.points];
    newPoints[index] = numValue;
    onUpdate(selectedAnnotation.id, { points: newPoints });
  };

  const colors = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
  ];

  return (
    <div className="w-72 bg-neutral-900 border-l border-white/10 flex flex-col h-full shadow-xl z-10">
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          <h2 className="text-[11px] font-bold text-neutral-400 uppercase tracking-[0.2em]">Annotation Properties</h2>
        </div>
        <button 
          onClick={() => setSelectedId(null)}
          className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
        >
          <Hash size={14} className="text-neutral-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {/* Label Section */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
            <Tag size={12} />
            Label
          </label>
          <input
            type="text"
            value={label}
            onChange={handleLabelChange}
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:border-blue-500/50 transition-all"
            placeholder="Enter label..."
          />
        </div>

        {/* Color Section */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
            <Palette size={12} />
            Color
          </label>
          <div className="grid grid-cols-4 gap-2">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => handleColorChange(c)}
                className={`w-full aspect-square rounded-lg border-2 transition-all ${
                  color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Geometry Info */}
        <div className="space-y-3 pt-4 border-t border-white/5">
          <label className="flex items-center gap-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
            <Maximize size={12} />
            Geometry
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-black/20 rounded-lg p-2 border border-white/5">
              <p className="text-[9px] font-bold text-neutral-600 uppercase">Type</p>
              <p className="text-[11px] font-mono text-neutral-300 mt-0.5 capitalize">{selectedAnnotation.type}</p>
            </div>
            <div className="bg-black/20 rounded-lg p-2 border border-white/5">
              <p className="text-[9px] font-bold text-neutral-600 uppercase">ID</p>
              <p className="text-[11px] font-mono text-neutral-300 mt-0.5 truncate">{selectedAnnotation.id}</p>
            </div>
          </div>
          
          {selectedAnnotation.type === 'bbox' && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="bg-black/20 rounded-lg p-2 border border-white/5">
                <p className="text-[9px] font-bold text-neutral-600 uppercase">Width</p>
                <p className="text-[11px] font-mono text-neutral-300 mt-0.5">{Math.round(selectedAnnotation.points[2])}px</p>
              </div>
              <div className="bg-black/20 rounded-lg p-2 border border-white/5">
                <p className="text-[9px] font-bold text-neutral-600 uppercase">Height</p>
                <p className="text-[11px] font-mono text-neutral-300 mt-0.5">{Math.round(selectedAnnotation.points[3])}px</p>
              </div>
            </div>
          )}

          {selectedAnnotation.type === 'polygon' && (
            <div className="space-y-3 mt-4 pt-4 border-t border-white/5">
              <label className="flex items-center gap-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                <Move size={12} />
                Points (X, Y)
              </label>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {Array.from({ length: Math.floor(selectedAnnotation.points.length / 2) }).map((_, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1 bg-black/20 rounded-lg p-1.5 border border-white/5">
                      <span className="text-[8px] font-bold text-neutral-600">X</span>
                      <input
                        type="number"
                        step="any"
                        value={selectedAnnotation.points[i * 2]}
                        onChange={(e) => handlePointChange(i * 2, e.target.value)}
                        className="w-full bg-transparent text-[10px] font-mono text-neutral-300 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1 bg-black/20 rounded-lg p-1.5 border border-white/5">
                      <span className="text-[8px] font-bold text-neutral-600">Y</span>
                      <input
                        type="number"
                        step="any"
                        value={selectedAnnotation.points[i * 2 + 1]}
                        onChange={(e) => handlePointChange(i * 2 + 1, e.target.value)}
                        className="w-full bg-transparent text-[10px] font-mono text-neutral-300 focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-white/10">
        <button
          onClick={() => {
            onDelete(selectedAnnotation.id);
            toast.error("Annotation deleted");
          }}
          className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-[11px] font-bold text-red-400 transition-all"
        >
          <Trash2 size={14} />
          Delete Annotation
        </button>
      </div>
    </div>
  );
};
