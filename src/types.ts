/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'parent' | 'child';

export interface UserProfile {
  id: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  points: number;
  householdId?: string;
  targetRewardId?: string;
  email: string;
}

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  adminId: string;
  createdAt: any;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  points: number;
  type: 'individual' | 'first_come';
  distributionType?: 'first_to_finish' | 'everyone_must'; // For 'first_come' type
  requiresProof?: boolean;
  emoji?: string;
  householdId: string;
  status: 'active' | 'in_progress' | 'pending' | 'completed';
  completedBy?: string;
  claimedBy?: string;
  completedByList?: string[]; // If everyone must complete, track who did
  photoURL?: string;
  proofUrl?: string; // Photo as proof of completion
  imageUrl?: string; // Task icon/image URL
  icon?: string;     // Lucide icon name
  updatedAt: any;
  assignedTo?: string; // For individual tasks
}

export interface Reward {
  id: string;
  title: string;
  description?: string;
  cost: number;
  householdId: string;
  imageUrl?: string;
  icon?: string;
  emoji?: string;
  category?: string;
  isSuggestion?: boolean;
  suggestedBy?: string;
  suggestedByPhoto?: string;
  status?: 'pending' | 'approved' | 'rejected';
  usageType?: 'once' | 'always';
  claimed?: boolean;
  claimedBy?: string;
  claimedAt?: any;
}

export type HistoryType = 'earn' | 'spend' | 'adj';

export interface HistoryEntry {
  id: string;
  userId: string;
  householdId: string;
  amount: number;
  type: HistoryType;
  description: string;
  timestamp: any;
}

export interface AppNotification {
  id: string;
  userId: string;
  householdId: string;
  message: string;
  read: boolean;
  timestamp: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}
