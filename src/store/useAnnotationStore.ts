import { create } from 'zustand';
import { Annotation, AnnotationType } from '../types';

interface AnnotationState {
  annotations: Annotation[];
  selectedId: string | null;
  tool: AnnotationType | 'select';
  history: Annotation[][];
  historyIndex: number;
  setAnnotations: (annotations: Annotation[]) => void;
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  setSelectedId: (id: string | null) => void;
  setTool: (tool: AnnotationType | 'select') => void;
  undo: () => void;
  redo: () => void;
  pushHistory: (newAnnotations: Annotation[]) => void;
}

export const useAnnotationStore = create<AnnotationState>((set, get) => ({
  annotations: [],
  selectedId: null,
  tool: 'select',
  history: [[]],
  historyIndex: 0,

  pushHistory: (newAnnotations) => {
    const { history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...newAnnotations]);
    
    // Limit history size to 50
    if (newHistory.length > 50) newHistory.shift();
    
    set({ 
      history: newHistory, 
      historyIndex: newHistory.length - 1,
      annotations: newAnnotations 
    });
  },

  setAnnotations: (annotations) => {
    set({ annotations, history: [annotations], historyIndex: 0 });
  },

  addAnnotation: (annotation) => {
    const newAnnotations = [...get().annotations, annotation];
    get().pushHistory(newAnnotations);
  },

  updateAnnotation: (id, updates) => {
    const newAnnotations = get().annotations.map((a) => (a.id === id ? { ...a, ...updates } : a));
    get().pushHistory(newAnnotations);
  },

  deleteAnnotation: (id) => {
    const newAnnotations = get().annotations.filter((a) => a.id !== id);
    const selectedId = get().selectedId === id ? null : get().selectedId;
    set({ selectedId });
    get().pushHistory(newAnnotations);
  },

  setSelectedId: (id) => set({ selectedId: id }),
  setTool: (tool) => set({ tool }),

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      set({ 
        historyIndex: newIndex, 
        annotations: [...history[newIndex]] 
      });
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      set({ 
        historyIndex: newIndex, 
        annotations: [...history[newIndex]] 
      });
    }
  },
}));
