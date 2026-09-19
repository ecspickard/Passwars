// Shared domain types, matching the FastAPI backend's JSON shapes.
// Fields marked "extended" don't exist in the current backend snapshot yet,
// but the product requires them, so the frontend is built against them.

export interface User {
  id: number;
  username: string;
  email: string;
  chess_username?: string | null; // extended
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface PlayerSummary {
  id: number;
  username: string;
  services: string[];
}

export interface LeaderboardEntry {
  id: number;
  username: string;
  password_count: number;
}

export interface ProfileResponse {
  id: number;
  username: string;
  created_at: string;
  offerings: string[];
  passwords_collected: number;
}

export interface UserPassword {
  id: number;
  service_name: string;
  secret_value?: string; // extended, only ever visible to the owner
  created_at?: string;
}

export interface BankEntry {
  id: number;
  service_name: string;
  secret_value?: string; // extended
  won_from_user_id?: number;
  won_at?: string;
}

export type ChallengeSource = "auto" | "self_reported"; // extended

export interface Challenge {
  id: string;
  challenger_id: number;
  defender_id: number;
  challenger_service: string;
  defender_service: string;
  challenger_name: string;
  status: "pending" | "accepted" | "denied" | "completed";
  winner_id?: number | null;
  accepted_at?: string | null; // extended
  source?: ChallengeSource; // extended
}
