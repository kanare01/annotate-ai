export type AnnotationType = 'bbox' | 'polygon' | 'keypoint';

export interface Annotation {
  id: string;
  type: AnnotationType;
  label: string;
  points: number[];
  color?: string;
  metadata?: Record<string, any>;
}

export interface ImageDoc {
  id: string;
  name: string;
  url: string;
  status: 'pending' | 'annotating' | 'reviewed' | 'completed';
  projectId: string;
  uploadedBy: string;
  createdAt: any;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'annotator' | 'reviewer';
}
