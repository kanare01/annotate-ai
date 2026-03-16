import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { storage, db, auth, handleFirestoreError, OperationType } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Upload, X, FileImage, CheckCircle2, AlertCircle, Loader2, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface Props {
  projectId: string;
  onUploadComplete: () => void;
  onClose: () => void;
}

interface FileWithPreview extends File {
  preview?: string;
}

export const ImageUpload: React.FC<Props> = ({ projectId, onUploadComplete, onClose }) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ [key: string]: number }>({});
  const [failedFiles, setFailedFiles] = useState<{ [key: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    console.log("Files dropped:", acceptedFiles.map(f => f.name));
    setFiles(prev => [
      ...prev,
      ...acceptedFiles.map(file => Object.assign(file, {
        preview: URL.createObjectURL(file)
      }))
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  useEffect(() => {
    return () => files.forEach(file => file.preview && URL.revokeObjectURL(file.preview));
  }, [files]);

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      return newFiles.filter((_, i) => i !== index);
    });
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    
    setUploading(true);
    setError(null);

    const user = auth.currentUser;
    if (!user) {
      setError("You must be logged in to upload images.");
      setUploading(false);
      return;
    }

    let successCount = 0;
    let failCount = 0;

    try {
      const uploadPromises = files.map(async (file) => {
        if (progress[file.name] === 100) return;

        setFailedFiles(prev => ({ ...prev, [file.name]: false }));
        const fileId = Math.random().toString(36).substring(7);
        const storageRef = ref(storage, `projects/${projectId}/images/${fileId}_${file.name}`);
        
        try {
          // Just upload the damn thing
          const snapshot = await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(snapshot.ref);
          
          // Save to database
          await addDoc(collection(db, 'projects', projectId, 'images'), {
            name: file.name,
            url: downloadURL,
            status: 'pending',
            projectId,
            uploadedBy: user.uid,
            createdAt: serverTimestamp()
          });
          
          successCount++;
          setProgress(prev => ({ ...prev, [file.name]: 100 }));
        } catch (err) {
          console.error(`Failed to upload ${file.name}:`, err);
          setFailedFiles(prev => ({ ...prev, [file.name]: true }));
          failCount++;
          
          if (err && typeof err === 'object' && 'code' in err && err.code === 'storage/unauthorized') {
            handleFirestoreError(err, OperationType.WRITE, `storage:projects/${projectId}/images`);
          }
        }
      });

      await Promise.allSettled(uploadPromises);

      if (successCount > 0) {
        toast.success(`Uploaded ${successCount} images`);
        onUploadComplete();
      }

      if (failCount > 0) {
        setError(`${failCount} images failed. Check your connection.`);
      } else {
        onClose();
      }
    } catch (err) {
      console.error("Global upload error:", err);
      setError("Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-neutral-900 border border-white/10 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-neutral-900/50 backdrop-blur-xl">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Upload Images</h2>
            <p className="text-neutral-500 text-xs mt-0.5">Add new assets to your project</p>
          </div>
          <div className="flex items-center gap-2">
            {files.length > 0 && !uploading && (
              <button 
                onClick={() => setFiles([])}
                className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 hover:text-red-400 transition-colors px-3 py-1 hover:bg-red-400/5 rounded-full"
              >
                Clear All
              </button>
            )}
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-white/5 rounded-full transition-all text-neutral-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-8">
          <div
            {...getRootProps()}
            className={`group border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer relative overflow-hidden ${
              isDragActive 
                ? 'border-blue-500 bg-blue-500/10' 
                : 'border-neutral-800 hover:border-neutral-600 hover:bg-white/5'
            }`}
          >
            <input {...getInputProps()} />
            <div className="relative z-10">
              <div className="w-16 h-16 bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                <Upload className={`${isDragActive ? 'text-blue-400' : 'text-neutral-400'} group-hover:text-blue-400 transition-colors`} size={32} />
              </div>
              <p className="text-neutral-200 font-semibold text-lg">
                {isDragActive ? 'Drop them now!' : 'Drop images here'}
              </p>
              <p className="text-neutral-500 text-sm mt-2">
                Or click to browse from your computer
              </p>
              <div className="flex items-center justify-center gap-4 mt-6">
                <span className="px-2 py-1 bg-neutral-800 rounded text-[10px] font-bold text-neutral-400 uppercase tracking-wider">JPG</span>
                <span className="px-2 py-1 bg-neutral-800 rounded text-[10px] font-bold text-neutral-400 uppercase tracking-wider">PNG</span>
                <span className="px-2 py-1 bg-neutral-800 rounded text-[10px] font-bold text-neutral-400 uppercase tracking-wider">WEBP</span>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {files.length > 0 && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-8 space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar"
              >
                {files.map((file, index) => (
                  <motion.div 
                    layout
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    key={file.name + index} 
                    className="group flex items-center gap-4 p-3 bg-neutral-800/50 rounded-2xl border border-white/5 hover:border-white/10 transition-all"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-neutral-800 shrink-0 border border-white/5">
                      {file.preview ? (
                        <img src={file.preview} alt="preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon size={20} className="text-neutral-600" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-neutral-200 truncate pr-4">{file.name}</p>
                        <span className="text-[10px] text-neutral-500 font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                      
                      <div className="relative w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress[file.name] || 0}%` }}
                          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
                            progress[file.name] === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {progress[file.name] === 100 ? (
                        <CheckCircle2 size={18} className="text-emerald-500" />
                      ) : failedFiles[file.name] ? (
                        <div className="flex items-center gap-2">
                          <AlertCircle size={18} className="text-red-400" />
                          {!uploading && (
                            <button 
                              onClick={() => handleUpload()} 
                              className="p-1.5 hover:bg-white/5 rounded-lg text-neutral-400 hover:text-blue-400 transition-all"
                              title="Retry"
                            >
                              <RefreshCw size={14} />
                            </button>
                          )}
                        </div>
                      ) : uploading ? (
                        <Loader2 size={18} className="text-blue-400 animate-spin" />
                      ) : (
                        <button 
                          onClick={() => removeFile(index)} 
                          className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                        >
                          <X size={18} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-sm"
            >
              <AlertCircle size={20} className="shrink-0" />
              <p className="font-medium">{error}</p>
            </motion.div>
          )}
        </div>

        <div className="p-6 bg-neutral-900/50 backdrop-blur-xl border-t border-white/5 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-white/10 font-bold text-neutral-400 hover:bg-white/5 hover:text-white transition-all text-sm"
          >
            {uploading ? 'Close' : 'Cancel'}
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
            className="flex-[2] py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-xl shadow-blue-600/20 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 text-sm"
          >
            {uploading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Uploading Assets...</span>
              </>
            ) : (
              <>
                <Upload size={18} />
                <span>Upload {files.length} {files.length === 1 ? 'Image' : 'Images'}</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
