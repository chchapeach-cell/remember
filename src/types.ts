export type Role = 'executive' | 'staff' | 'general';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: Role;
}

export type Priority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  assignee?: string;
  assignees?: string[];
  priority: Priority;
  status: 'pending' | 'in_progress' | 'completed';
  createdBy: string;
  createdAt: number;
  attachmentUrl?: string;
  attachmentName?: string;
}
