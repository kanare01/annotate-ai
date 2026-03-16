import React from 'react';
import { MousePointer2, Square, Pentagon, Target, Sparkles, Download, Trash2, Plus, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useAnnotationStore } from '../store/useAnnotationStore';
import { AnnotationType, ImageDoc } from '../types';
import { toast } from 'sonner';

interface Props {
  onAutoAnnotate: () => void;
  onBatchAutoAnnotate: () => void;
  images: ImageDoc[];
  currentImageId: string | null;
  onSelectImage: (image: ImageDoc) => void;
  onUploadClick: () => void;
  isAnalyzing?: boolean;
}

export const Sidebar: React.FC<Props> = ({ 
  onAutoAnnotate, 
  onBatchAutoAnnotate,
  images, 
  currentImageId, 
  onSelectImage, 
  onUploadClick,
  isAnalyzing
}) => {
  const { tool, setTool, annotations, deleteAnnotation, selectedId, setSelectedId } = useAnnotationStore();

  return (
    <div className="w-72 bg-neutral-900 border-r border-white/10 flex flex-col h-full shadow-xl z-10">
      {/* Images Section */}
      <div className="flex-1 overflow-hidden flex flex-col border-b border-white/10">
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold text-neutral-500 uppercase tracking-[0.15em]">Assets</h2>
            <button 
              onClick={onUploadClick}
              className="flex items-center gap-1.5 px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[10px] font-bold text-neutral-300 transition-all"
            >
              <Plus size={12} />
              Upload
            </button>
          </div>
          
          <button
            onClick={onBatchAutoAnnotate}
            disabled={isAnalyzing || images.length === 0}
            className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 rounded-xl text-[10px] font-bold text-blue-400 transition-all disabled:opacity-50"
          >
            {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Batch Auto-Annotate All
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1 custom-scrollbar">
          {images.map((img) => (
            <button
              key={img.id}
              onClick={() => onSelectImage(img)}
              className={`w-full group flex items-center gap-3 p-2 rounded-xl border transition-all duration-200 ${
                currentImageId === img.id
                  ? 'bg-blue-600/10 border-blue-500/30 text-blue-100 ring-1 ring-blue-500/20'
                  : 'bg-transparent border-transparent text-neutral-500 hover:bg-white/5 hover:text-neutral-300'
              }`}
            >
              <div className="w-12 h-12 rounded-lg bg-neutral-800 shrink-0 overflow-hidden border border-white/5 shadow-inner">
                <img src={img.url} alt={img.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" referrerPolicy="no-referrer" />
              </div>
              <div className="flex-1 overflow-hidden text-left">
                <p className="text-[11px] font-bold truncate">{img.name}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${img.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <p className="text-[9px] font-bold opacity-40 uppercase tracking-wider">{img.status}</p>
                </div>
              </div>
            </button>
          ))}
          {images.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 opacity-20">
              <ImageIcon size={32} strokeWidth={1.5} />
              <p className="text-[10px] font-bold mt-2 uppercase tracking-widest">Empty Library</p>
            </div>
          )}
        </div>
      </div>

      {/* Annotations Section */}
      <div className="flex-1 overflow-hidden flex flex-col bg-black/10">
        <div className="p-4 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-2">
            <h2 className="text-[11px] font-bold text-neutral-500 uppercase tracking-[0.15em]">Layers</h2>
            <span className="text-[9px] font-mono bg-white/5 px-1.5 py-0.5 rounded text-neutral-500 border border-white/5">
              {annotations.length}
            </span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5 custom-scrollbar">
          {annotations.map((ann) => (
            <div
              key={ann.id}
              onClick={() => setSelectedId(ann.id)}
              className={`group flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all duration-200 ${
                selectedId === ann.id
                  ? 'bg-blue-600/10 border-blue-500/30 text-blue-100'
                  : 'bg-transparent border-transparent text-neutral-500 hover:bg-white/5 hover:text-neutral-400'
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-4 h-4 rounded border border-white/10 flex items-center justify-center bg-neutral-800">
                  {ann.type === 'bbox' && <Square size={10} style={{ color: ann.color }} />}
                  {ann.type === 'polygon' && <Pentagon size={10} style={{ color: ann.color }} />}
                  {ann.type === 'keypoint' && <Target size={10} style={{ color: ann.color }} />}
                </div>
                <span className="text-[11px] font-medium truncate">{ann.label}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteAnnotation(ann.id);
                  toast.info("Layer removed");
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-md transition-all"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {annotations.length === 0 && (
            <div className="text-center py-12 opacity-10">
              <p className="text-[10px] font-bold uppercase tracking-widest italic">No layers yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
