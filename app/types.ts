export type UserRole = 'Intern' | 'Staff' | 'Manager IT' | 'Deputy Manager' | 'DM Application' | 'DM Infrastructure' | 'Head of NipeX';
export type AvailabilityState = 'On-Site' | 'Remote' | 'Off-Duty' | 'Emergency Pass';

export interface AuthUser {
  id: number; 
  email: string;
  name: string;
  role: UserRole;
  specificTitle: string;
  department: string;
}

export interface EmergencyRequest {
  id: string;
  memberName: string;
  day: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Declined';
}

export interface TeamMember {
  id: number;
  name: string;
  role: UserRole;
  specificTitle: string;
  department: string;
  schedule: { [key: string]: AvailabilityState };
}