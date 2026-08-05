export type UserRole = 
  | 'Intern' 
  | 'Staff' 
  | 'Manager IT' 
  | 'Deputy Manager' 
  | 'DM Application' 
  | 'DM Infrastructure' 
  | 'Head of NipeX';

export type AvailabilityState = 'Present' | 'Absent';

export interface AuthUser {
  id: number; 
  email: string;
  name: string;
  role: UserRole;
  specificTitle: string;
  department: string;
}

export interface TeamMember {
  id: number;
  name: string;
  role: string;
  specificTitle: string;
  department: string;
  schedule: Record<string, string>;
  absenceReasons?: Record<string, string>; 
}