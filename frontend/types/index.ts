export type Role = "SUPER_ADMIN" | "MATCHMAKER" | "MALE_USER";
export type Status =
  | "ACTIVE"
  | "PENDING"
  | "VERIFIED"
  | "SUSPENDED"
  | "BLOCKED"
  | "CLOSED"
  | string;
export interface User {
  id: string;
  first_name?: string;
  phone?: string;
  email?: string;
  role: Role;
  status?: Status;
  governorate?: string;
  verification_status?: Status;
  permissions?: string[];
}
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  user?: User;
}
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string | null;
  error?: { code: string; message: string };
}
export interface FemaleLead {
  id: string;
  phone: string;
  governorate: string;
  appointment_id?: string;
  appointment_status?: string;
  scheduled_at?: string;
  notes?: string;
  status: string;
  created_at?: string;
}
export interface FemaleProfile {
  id: string;
  public_code: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  age: number;
  governorate: string;
  city?: string;
  height?: number;
  education?: string;
  occupation?: string;
  marital_status?: string;
  hijab_status?: string;
  public_summary?: string;
  status: string;
  contact_preference?: string;
  created_at?: string;
}
export interface MaleRequest {
  id: string;
  request_code: string;
  male_user_id?: string;
  male_characteristics?: Record<string, unknown>;
  desired_female_characteristics?: Record<string, unknown>;
  assigned_matchmaker_id?: string;
  verification_status: string;
  workflow_status: string;
  is_active?: boolean;
  match_count?: number;
  created_at?: string;
  updated_at?: string;
}
export interface ConversationSummary {
  session_key: string;
  state?: Record<string, unknown>;
  completed?: boolean;
  updated_at?: string;
}
export interface MalePhoneChallenge {
  challenge_id?: string;
  otp_required: boolean;
  expires_in_seconds?: number;
  expires_in?: number;
  mock_otp?: string;
  phone?: string;
  tokens?: AuthTokens;
  access_token?: string;
  refresh_token?: string;
  user?: User;
}
export interface AuthSession extends AuthTokens {
  tokens: AuthTokens;
  user?: User;
  is_new_user?: boolean;
  active_request?: MaleRequest | null;
  conversation?: ConversationSummary | null;
}
export type MeResponse = User & {
  user?: User;
  active_request?: MaleRequest | null;
  conversation?: ConversationSummary | null;
};
export interface MatchCase {
  id: string;
  case_code?: string;
  male_request_id: string;
  female_profile_id?: string;
  status: string;
  female_decision?: string;
  male_decision?: string;
  mutual_score?: number;
  updated_at?: string;
}
export interface Payment {
  id: string;
  male_request_id: string;
  match_case_id?: string;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  reference?: string;
  paid_at?: string;
}
export interface Meeting {
  id: string;
  match_case_id: string;
  meeting_type: string;
  scheduled_at: string;
  location_or_link?: string;
  status: string;
  notes?: string;
}
export interface Notification {
  id: string;
  title?: string;
  message?: string;
  body?: string;
  type: string;
  read_at?: string;
  created_at?: string;
}
export interface DashboardData {
  stats?: Record<string, number>;
  recent_activity?: Array<{
    id: string;
    description: string;
    created_at?: string;
  }>;
  top_matchmakers?: Array<{ id: string; name: string; cases: number }>;
  charts?: Record<string, Array<Record<string, string | number>>>;
}
