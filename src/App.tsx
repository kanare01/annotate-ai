import React, { useEffect, useState } from 'react';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, onSnapshot, query, orderBy, limit, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Sidebar } from './components/Sidebar';
import { PropertyPanel } from './components/PropertyPanel';
import { AnnotationCanvas } from './components/canvas/AnnotationCanvas';
import { ImageUpload } from './components/ImageUpload';
import { useAnnotationStore } from './store/useAnnotationStore';
import { autoAnnotate } from './services/aiService';
import { LogIn, LogOut, Image as ImageIcon, Download, Share2, Settings, Loader2, Sparkles, Undo2, Redo2, MousePointer2, Square, Pentagon, Target, HelpCircle, X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageDoc, Project, Annotation } from './types';
import { Toaster, toast } from 'sonner';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [images, setImages] = useState<ImageDoc[]>([]);
  const [currentImage, setCurrentImage] = useState<ImageDoc | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const { annotations, setAnnotations, addAnnotation, undo, redo, tool, setTool } = useAnnotationStore();
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const userRef = doc(db, 'users', u.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: u.uid,
            email: u.email,
            displayName: u.displayName,
            role: 'annotator',
            createdAt: new Date().toISOString()
          });
        }

        const projectRef = doc(db, 'projects', 'default_' + u.uid);
        const projectSnap = await getDoc(projectRef);
        if (!projectSnap.exists()) {
          const newProject = {
            id: 'default_' + u.uid,
            name: 'Default Project',
            description: 'Your first annotation project',
            ownerId: u.uid,
            createdAt: new Date().toISOString()
          };
          await setDoc(projectRef, newProject);
          setCurrentProject(newProject);
        } else {
          setCurrentProject({ id: projectSnap.id, ...projectSnap.data() } as Project);
        }
      } else {
        setUser(null);
        setCurrentProject(null);
        setImages([]);
        setCurrentImage(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentProject) return;
    const q = query(collection(db, 'projects', currentProject.id, 'images'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const imgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ImageDoc));
      setImages(imgs);
      if (imgs.length > 0 && !currentImage) setCurrentImage(imgs[0]);
    });
    return unsubscribe;
  }, [currentProject]);

  useEffect(() => {
    if (!currentProject || !currentImage) {
      setAnnotations([]);
      return;
    }
    const q = collection(db, 'projects', currentProject.id, 'images', currentImage.id, 'annotations');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const anns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setAnnotations(anns);
    });
    return unsubscribe;
  }, [currentImage, currentProject]);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Welcome back!");
    } catch (error: any) {
      console.error("Login failed", error);
      setAuthError(error.message || "An unexpected error occurred.");
      toast.error("Login failed");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAutoAnnotate = async () => {
    if (!currentImage || !currentProject) return;
    
    setIsAnalyzing(true);
    const promise = new Promise(async (resolve, reject) => {
      try {
        const response = await fetch(currentImage.url);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const results = await autoAnnotate(base64data);
          
          if (results && results.length > 0) {
            const annotationsRef = collection(db, 'projects', currentProject.id, 'images', currentImage.id, 'annotations');
            
            const savePromises = results.map((res: any) => {
              const [ymin, xmin, ymax, xmax] = res.box_2d;
              return addDoc(annotationsRef, {
                type: 'bbox',
                label: res.label,
                points: [
                  (xmin / 1000) * canvasSize.width,
                  (ymin / 1000) * canvasSize.height,
                  ((xmax - xmin) / 1000) * canvasSize.width,
                  ((ymax - ymin) / 1000) * canvasSize.height
                ],
                color: '#10b981',
                createdAt: serverTimestamp(),
                createdBy: 'ai'
              });
            });

            await Promise.all(savePromises);
            resolve(results.length);
          } else {
            reject("No objects detected");
          }
        };
      } catch (err) {
        reject(err);
      }
    });

    toast.promise(promise, {
      loading: 'Gemini AI is analyzing the image...',
      success: (count) => `Detected and saved ${count} objects!`,
      error: (err) => `AI Analysis failed: ${err}`,
    });

    try {
      await promise;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleBatchAutoAnnotate = async () => {
    if (!currentProject || images.length === 0) return;
    
    setIsAnalyzing(true);
    const promise = new Promise(async (resolve, reject) => {
      try {
        let totalDetected = 0;
        for (const img of images) {
          // Check if image already has annotations to avoid duplicates (optional)
          // For now, we'll just run it for all
          const response = await fetch(img.url);
          const blob = await response.blob();
          const reader = new FileReader();
          
          const result = await new Promise<number>((res, rej) => {
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
              try {
                const base64data = reader.result as string;
                const aiResults = await autoAnnotate(base64data);
                
                if (aiResults && aiResults.length > 0) {
                  const annotationsRef = collection(db, 'projects', currentProject.id, 'images', img.id, 'annotations');
                  const savePromises = aiResults.map((aiRes: any) => {
                    const [ymin, xmin, ymax, xmax] = aiRes.box_2d;
                    return addDoc(annotationsRef, {
                      type: 'bbox',
                      label: aiRes.label,
                      points: [
                        (xmin / 1000) * canvasSize.width,
                        (ymin / 1000) * canvasSize.height,
                        ((xmax - xmin) / 1000) * canvasSize.width,
                        ((ymax - ymin) / 1000) * canvasSize.height
                      ],
                      color: '#10b981',
                      createdAt: serverTimestamp(),
                      createdBy: 'ai'
                    });
                  });
                  await Promise.all(savePromises);
                  res(aiResults.length);
                } else {
                  res(0);
                }
              } catch (e) {
                rej(e);
              }
            };
          });
          totalDetected += result;
        }
        resolve(totalDetected);
      } catch (err) {
        reject(err);
      }
    });

    toast.promise(promise, {
      loading: 'Gemini AI is batch processing all images...',
      success: (count) => `Batch complete! Detected ${count} objects across ${images.length} images.`,
      error: (err) => `Batch processing failed: ${err}`,
    });

    try {
      await promise;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddAnnotation = async (ann: Omit<Annotation, 'id'>) => {
    if (!currentProject || !currentImage) return;
    try {
      const annotationsRef = collection(db, 'projects', currentProject.id, 'images', currentImage.id, 'annotations');
      await addDoc(annotationsRef, {
        ...ann,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || 'anonymous'
      });
    } catch (error) {
      console.error("Failed to add annotation", error);
      toast.error("Failed to save annotation");
    }
  };

  const handleUpdateAnnotation = async (id: string, updates: Partial<Annotation>) => {
    if (!currentProject || !currentImage) return;
    try {
      const annRef = doc(db, 'projects', currentProject.id, 'images', currentImage.id, 'annotations', id);
      await updateDoc(annRef, updates);
    } catch (error) {
      console.error("Failed to update annotation", error);
      toast.error("Failed to update annotation");
    }
  };

  const handleDeleteAnnotation = async (id: string) => {
    if (!currentProject || !currentImage) return;
    try {
      const annRef = doc(db, 'projects', currentProject.id, 'images', currentImage.id, 'annotations', id);
      await deleteDoc(annRef);
    } catch (error) {
      console.error("Failed to delete annotation", error);
      toast.error("Failed to delete annotation");
    }
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(annotations, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `annotations_${currentImage?.name || 'export'}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    toast.success("Annotations exported successfully");
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.key.toLowerCase()) {
        case 'v': setTool('select'); break;
        case 'r': setTool('bbox'); break;
        case 'p': setTool('polygon'); break;
        case 'k': setTool('keypoint'); break;
        case 'backspace':
        case 'delete':
          const selectedId = useAnnotationStore.getState().selectedId;
          if (selectedId) {
            handleDeleteAnnotation(selectedId);
            toast.info("Annotation deleted");
          }
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool, annotations]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
        <Toaster position="top-center" theme="dark" />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-neutral-900 p-8 rounded-3xl border border-white/5 shadow-2xl text-center"
        >
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-600/20">
            <ImageIcon className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">AnnotateAI</h1>
          <p className="text-neutral-400 mb-8">Professional image annotation powered by Gemini AI. Start labeling your datasets today.</p>
          
          {authError && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-sm">
              {authError}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className={`w-full flex items-center justify-center gap-3 py-4 bg-white text-black rounded-xl font-semibold transition-all ${
              isLoggingIn ? 'opacity-50 cursor-not-allowed' : 'hover:bg-neutral-200'
            }`}
          >
            {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn size={20} />}
            {isLoggingIn ? 'Connecting...' : 'Continue with Google'}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-neutral-950 text-white flex flex-col overflow-hidden">
      <Toaster position="bottom-right" theme="dark" richColors />
      
      {/* Header */}
      <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-neutral-900/50 backdrop-blur-xl z-20">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <ImageIcon size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">AnnotateAI</h1>
            <p className="text-[10px] text-neutral-500 font-medium uppercase tracking-widest">
              {currentProject?.name} / {currentImage?.name || 'No image selected'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setShowHelp(true)} className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-all" title="Keyboard Shortcuts">
            <HelpCircle size={20} />
          </button>
          <button onClick={handleExport} className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-all" title="Export JSON">
            <Download size={20} />
          </button>
          <button className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-all">
            <Share2 size={20} />
          </button>
          <div className="w-px h-6 bg-white/10 mx-1" />
          <button onClick={() => auth.signOut()} className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-xs font-medium transition-all">
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <Sidebar 
          onAutoAnnotate={handleAutoAnnotate}
          onBatchAutoAnnotate={handleBatchAutoAnnotate}
          images={images}
          currentImageId={currentImage?.id || null}
          onSelectImage={(img) => setCurrentImage(img)}
          onUploadClick={() => setShowUpload(true)}
          isAnalyzing={isAnalyzing}
        />

        <main className="flex-1 relative bg-neutral-950 flex items-center justify-center overflow-hidden">
          {/* Vertical Toolbar */}
          <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-2 bg-neutral-900/90 backdrop-blur-md border border-white/10 p-2 rounded-2xl shadow-2xl z-30">
            <ToolbarButton icon={MousePointer2} active={tool === 'select'} onClick={() => setTool('select')} label="Select (V)" />
            <div className="w-8 h-px bg-white/10 my-1 mx-auto" />
            <ToolbarButton icon={Square} active={tool === 'bbox'} onClick={() => setTool('bbox')} label="Rectangle (R)" />
            <ToolbarButton icon={Pentagon} active={tool === 'polygon'} onClick={() => setTool('polygon')} label="Polygon (P)" />
            <ToolbarButton icon={Target} active={tool === 'keypoint'} onClick={() => setTool('keypoint')} label="Keypoint (K)" />
            <div className="w-8 h-px bg-white/10 my-1 mx-auto" />
            <ToolbarButton icon={Undo2} onClick={undo} label="Undo (Ctrl+Z)" />
            <ToolbarButton icon={Redo2} onClick={redo} label="Redo (Ctrl+Shift+Z)" />
            <div className="w-8 h-px bg-white/10 my-1 mx-auto" />
            <button 
              onClick={handleAutoAnnotate}
              disabled={isAnalyzing || !currentImage}
              title="AI Auto-Annotate"
              className={`p-2.5 rounded-xl transition-all ${
                isAnalyzing ? 'bg-blue-600/50 text-white' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20'
              } disabled:opacity-50`}
            >
              {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            </button>
            <button 
              onClick={async () => {
                if (confirm("Clear all annotations for this image?")) {
                  const deletePromises = annotations.map(ann => handleDeleteAnnotation(ann.id));
                  await Promise.all(deletePromises);
                  toast.success("Canvas cleared");
                }
              }}
              disabled={annotations.length === 0}
              title="Clear All"
              className="p-2.5 text-neutral-500 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all disabled:opacity-20"
            >
              <Trash2 size={18} />
            </button>
          </div>

          <div className="relative w-full h-full flex items-center justify-center p-12 overflow-auto custom-scrollbar">
            {currentImage ? (
              <AnnotationCanvas 
                imageUrl={currentImage.url}
                width={canvasSize.width}
                height={canvasSize.height}
                onAutoAnnotate={handleAutoAnnotate}
                onAddAnnotation={handleAddAnnotation}
                onUpdateAnnotation={handleUpdateAnnotation}
                onDeleteAnnotation={handleDeleteAnnotation}
              />
            ) : (
              <div className="text-center">
                <ImageIcon className="mx-auto mb-4 opacity-10" size={80} />
                <h3 className="text-xl font-medium text-neutral-500">No image selected</h3>
                <p className="text-neutral-600 mt-2">Upload or select an image from the sidebar to start annotating.</p>
                <button onClick={() => setShowUpload(true)} className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-all">
                  Upload First Image
                </button>
              </div>
            )}
          </div>
        </main>

        <PropertyPanel 
          onUpdate={handleUpdateAnnotation}
          onDelete={handleDeleteAnnotation}
        />
      </div>

      <AnimatePresence>
        {showUpload && currentProject && (
          <ImageUpload 
            projectId={currentProject.id}
            onClose={() => setShowUpload(false)}
            onUploadComplete={() => toast.success("Upload complete")}
          />
        )}
        {showHelp && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md w-full bg-neutral-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-neutral-800/50">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <HelpCircle size={20} className="text-blue-500" />
                  Keyboard Shortcuts
                </h2>
                <button onClick={() => setShowHelp(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <ShortcutItem keyName="V" description="Select Tool" />
                <ShortcutItem keyName="R" description="Rectangle Tool" />
                <ShortcutItem keyName="P" description="Polygon Tool" />
                <ShortcutItem keyName="K" description="Keypoint Tool" />
                <ShortcutItem keyName="Delete / Backspace" description="Delete Selected Annotation" />
                <ShortcutItem keyName="Ctrl + Z" description="Undo" />
                <ShortcutItem keyName="Ctrl + Shift + Z" description="Redo" />
                <ShortcutItem keyName="Mouse Wheel" description="Zoom In/Out" />
                <ShortcutItem keyName="Shift + Drag" description="Pan Canvas" />
              </div>
              <div className="p-6 bg-neutral-800/30 text-center">
                <button 
                  onClick={() => setShowHelp(false)}
                  className="px-8 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-sm transition-all"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ShortcutItem({ keyName, description }: { keyName: string, description: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-neutral-400">{description}</span>
      <kbd className="px-2 py-1 bg-neutral-800 border border-white/10 rounded-md text-[10px] font-mono text-neutral-300 shadow-sm min-w-[30px] text-center">
        {keyName}
      </kbd>
    </div>
  );
}

function ToolbarButton({ icon: Icon, active, onClick, label }: any) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 ${
          active 
            ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)] scale-105' 
            : 'text-neutral-500 hover:text-neutral-200 hover:bg-white/5'
        }`}
      >
        <Icon size={20} />
      </button>
      <div className="absolute left-full ml-3 px-2 py-1 bg-neutral-800 text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-white/10 shadow-xl">
        {label}
      </div>
    </div>
  );
}
