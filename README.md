# Vid2Txt - Video to Text for AI

A Micro SaaS tool that converts videos, audio files, and images to optimized text for AI tools.

## Features

- 🎥 Video to text transcription
- 🎵 Audio file support
- 🖼️ Image OCR (coming soon)
- 🤖 AI text optimization with DeepSeek
- 💰 Pay-per-use pricing ($0.20 per 10 minutes)
- 🌐 Bilingual support (English/Vietnamese)
- 🔐 Google OAuth authentication
- ⚡ Client-side video to audio conversion (FFmpeg.wasm)

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (Google OAuth)
- **AI/ML**: 
  - Deepgram/Groq for speech-to-text
  - DeepSeek for text post-processing
- **Video Processing**: FFmpeg.wasm (client-side)
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Deepgram or Groq API key
- DeepSeek API key

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd vid2txt-saas
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:

Create a `.env.local` file:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# API Keys
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPGRAM_API_KEY=your_deepgram_api_key
# OR
GROQ_API_KEY=your_groq_api_key

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Payment (Stripe - Recommended)
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Payment (PayOS - For Vietnam market)
PAYOS_CLIENT_ID=your_payos_client_id
PAYOS_API_KEY=your_payos_api_key
PAYOS_CHECKSUM_KEY=your_payos_checksum_key
```

4. Set up Supabase:

   a. Create a new project at [supabase.com](https://supabase.com)
   
   b. Run the following SQL in the Supabase SQL Editor:
```sql
-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  credits NUMERIC DEFAULT 3.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  amount NUMERIC NOT NULL,
  credits_added NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  payment_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create processing_jobs table
CREATE TABLE IF NOT EXISTS processing_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('video', 'audio', 'zip', 'image')),
  duration_seconds NUMERIC,
  credits_used NUMERIC NOT NULL,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  result_text TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own jobs" ON processing_jobs
  FOR SELECT USING (auth.uid() = user_id);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url, credits)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    3.0 -- 3 minutes free trial
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

   c. Enable Google OAuth:
      - Go to Authentication > Providers in Supabase Dashboard
      - Enable Google provider
      - Add your Google OAuth credentials

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import your repository in Vercel
3. Add all environment variables from `.env.local`
4. Deploy!

### Supabase Configuration for Production

1. Add your Vercel domain to Supabase:
   - Go to Authentication > URL Configuration
   - Add your production URL to "Site URL"
   - Add redirect URLs

2. Update Google OAuth redirect URIs in Google Cloud Console

## Pricing

- **$0.20** per 10 minutes of video
- Free trial: 3 minutes (3 credits) on signup
- Credits are consumed based on actual video duration

## How It Works

1. **Upload**: User uploads video/audio file
2. **Convert**: Client-side FFmpeg converts video to MP3 (optional for audio files)
3. **Transcribe**: Audio is sent to Deepgram/Groq API for transcription
4. **Optimize**: Text is processed by DeepSeek to improve quality
5. **Download**: User gets clean, optimized Markdown text

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── transcribe/          # Transcription API
│   │   └── process-text/        # Text optimization API
│   ├── auth/
│   │   └── callback/            # OAuth callback
│   ├── dashboard/               # User dashboard
│   ├── login/                   # Login page
│   ├── pricing/                 # Pricing page
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Home page
│   └── globals.css              # Global styles
├── components/
│   ├── header.tsx               # Navigation header
│   ├── video-uploader.tsx       # File upload component
│   ├── result-display.tsx       # Transcription result display
│   ├── providers.tsx            # Context providers
│   └── language-provider.tsx    # i18n provider
├── lib/
│   └── supabase/
│       ├── client.ts            # Supabase client
│       └── server.ts            # Supabase admin client
├── store/
│   └── useAppStore.ts           # Zustand state management
└── types/
    └── supabase.ts              # TypeScript types

```

## API Routes

### POST /api/transcribe
Transcribes audio/video to text.

**Request**: FormData
- `audio`: File (audio file)
- `fileType`: string (video/audio)
- `durationSeconds`: number

**Response**:
```json
{
  "success": true,
  "text": "transcribed text...",
  "creditsRemaining": 2.5
}
```

### POST /api/process-text
Optimizes transcribed text using AI.

**Request**: JSON
```json
{
  "text": "raw transcribed text..."
}
```

**Response**:
```json
{
  "success": true,
  "text": "optimized text..."
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `DEEPSEEK_API_KEY` | DeepSeek API key | Yes |
| `DEEPGRAM_API_KEY` or `GROQ_API_KEY` | Speech-to-text API key | Yes |
| `NEXT_PUBLIC_APP_URL` | App URL (for OAuth redirects) | Yes |
| `STRIPE_SECRET_KEY` | Stripe secret key | Yes - for international payments |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | Yes - for international payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | Yes - for payment verification |
| `PAYOS_CLIENT_ID` | PayOS client ID | For Vietnam market |
| `PAYOS_API_KEY` | PayOS API key | For Vietnam market |
| `PAYOS_CHECKSUM_KEY` | PayOS checksum key | For Vietnam market |

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.