export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          credits: number;
          subscription_tier: 'free' | 'pro';
          subscription_stripe_id: string | null;
          subscription_status: 'active' | 'canceled' | 'past_due' | null;
          subscription_period_end: string | null;
          zip_daily_count: number;
          zip_daily_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          credits?: number;
          subscription_tier?: 'free' | 'pro';
          subscription_stripe_id?: string | null;
          subscription_status?: 'active' | 'canceled' | 'past_due' | null;
          subscription_period_end?: string | null;
          zip_daily_count?: number;
          zip_daily_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          credits?: number;
          subscription_tier?: 'free' | 'pro';
          subscription_stripe_id?: string | null;
          subscription_status?: 'active' | 'canceled' | 'past_due' | null;
          subscription_period_end?: string | null;
          zip_daily_count?: number;
          zip_daily_date?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          credits_added: number;
          payment_method: string;
          payment_id: string | null;
          status: 'pending' | 'completed' | 'failed';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          credits_added: number;
          payment_method: string;
          payment_id?: string | null;
          status?: 'pending' | 'completed' | 'failed';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          credits_added?: number;
          payment_method?: string;
          payment_id?: string | null;
          status?: 'pending' | 'completed' | 'failed';
          created_at?: string;
        };
      };
      processing_jobs: {
        Row: {
          id: string;
          user_id: string;
          file_name: string;
          file_type: 'video' | 'audio' | 'zip' | 'image' | 'folder';
          duration_seconds: number | null;
          credits_used: number;
          status: 'processing' | 'completed' | 'failed';
          result_text: string | null;
          error_message: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          file_name: string;
          file_type: 'video' | 'audio' | 'zip' | 'image' | 'folder';
          duration_seconds?: number | null;
          credits_used: number;
          status?: 'processing' | 'completed' | 'failed';
          result_text?: string | null;
          error_message?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          file_name?: string;
          file_type?: 'video' | 'audio' | 'zip' | 'image' | 'folder';
          duration_seconds?: number | null;
          credits_used?: number;
          status?: 'processing' | 'completed' | 'failed';
          result_text?: string | null;
          error_message?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
      };
    };
  };
}