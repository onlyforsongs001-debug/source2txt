# Vid2Txt - Setup Guide

## Prerequisites

Before you begin, ensure you have:
- Node.js 18+ installed
- A Supabase account
- API keys for DeepSeek, and either Deepgram or Groq
- (Optional) Stripe account for payments

## Step-by-Step Setup

### 1. Clone and Install

```bash
cd vid2txt-saas
npm install
```

### 2. Configure Environment Variables

Create `.env.local` in the root directory:

```env
# Supabase (Get from https://supabase.com)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI APIs
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPGRAM_API_KEY=your_deepgram_api_key
# OR
GROQ_API_KEY=your_groq_api_key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Stripe Payment (Optional - for international users)
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# PayOS Payment (Optional - for Vietnam market)
PAYOS_CLIENT_ID=your_payos_client_id
PAYOS_API_KEY=your_payos_api_key
PAYOS_CHECKSUM_KEY=your_payos_checksum_key
```

### 3. Set Up Supabase Database

1. Go to your Supabase project: https://supabase.com
2. Navigate to **SQL Editor**
3. Run this SQL:

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

### 4. Enable Google OAuth

In Supabase Dashboard:
1. Go to **Authentication** > **Providers**
2. Enable **Google**
3. Add your Google OAuth credentials:
   - Get credentials from https://console.cloud.google.com
   - Add authorized redirect URIs

### 5. (Optional) Set Up Stripe Payments

1. Create Stripe account at https://stripe.com
2. Get API keys from Stripe Dashboard
3. Set up webhook endpoint:
   - URL: `https://yourdomain.com/api/payments/webhook`
   - Events: `checkout.session.completed`
4. Add webhook secret to `.env.local`

### 6. Run Development Server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### 7. Build for Production

```bash
npm run build
npm start
```

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 Client ID
5. Add authorized redirect URIs:
   - `http://localhost:3000/auth/callback` (development)
   - `https://yourdomain.com/auth/callback` (production)
6. Copy Client ID and Client Secret to Supabase

## API Keys Guide

### DeepSeek
- Sign up at https://platform.deepseek.com
- Generate API key
- Add to `.env.local` as `DEEPSEEK_API_KEY`

### Deepgram
- Sign up at https://deepgram.com
- Get API key from dashboard
- Add to `.env.local` as `DEEPGRAM_API_KEY`
- Note: Deepgram gives $200 free credit

### Groq (Alternative to Deepgram)
- Sign up at https://groq.com
- Get API key
- Add to `.env.local` as `GROQ_API_KEY`
- Groq offers free tier with rate limits

## Pricing Configuration

Current pricing: **$0.20 per 10 minutes**

To modify pricing:
1. Open `src/app/api/transcribe/route.ts`
2. Change the `creditsNeeded` calculation (line ~50)
3. Update `src/app/api/payments/create-checkout/route.ts` to reflect new pricing

## Deployment to Vercel

1. Push code to GitHub
2. Import repository in Vercel
3. Add all environment variables
4. Deploy!

Important: Update these in Supabase after deployment:
- Site URL: `https://your-app.vercel.app`
- Redirect URLs: `https://your-app.vercel.app/auth/callback`

## Troubleshooting

### Build Errors
```bash
# Clear cache and reinstall
rm -rf .next node_modules
npm install
npm run build
```

### Supabase Auth Not Working
- Check redirect URLs match exactly
- Ensure Google OAuth is enabled
- Verify environment variables are set

### FFmpeg.wasm Issues
- Ensure browser supports WebAssembly
- Check console for CORS errors
- Video files > 500MB may fail in-browser

### Payment Webhook Not Triggered
- Use Stripe CLI for local testing: `stripe listen --forward-to localhost:3000/api/payments/webhook`
- Verify webhook secret matches
- Check Stripe Dashboard > Developers > Webhooks

## Project Structure

```
vid2txt-saas/
├── src/
│   ├── app/
│   │   ├── api/              # API routes
│   │   ├── auth/             # OAuth callbacks
│   │   ├── dashboard/        # User dashboard
│   │   ├── login/            # Login page
│   │   ├── pricing/          # Pricing page
│   │   ├── payment/          # Payment success page
│   │   ├── layout.tsx        # Root layout
│   │   └── page.tsx          # Home page
│   ├── components/           # React components
│   ├── lib/                  # Utilities
│   ├── store/                # State management
│   └── types/                # TypeScript types
├── .env.local                # Environment variables
├── package.json
├── README.md
└── SETUP.md
```

## Support

For issues:
1. Check this setup guide
2. Review README.md for API documentation
3. Check Supabase logs for database errors
4. Check Vercel logs for deployment issues

## Next Steps

- [ ] Replace placeholder API keys with real ones
- [ ] Configure Stripe/PayOS for payments
- [ ] Test OAuth flow end-to-end
- [ ] Upload a test video to verify transcription
- [ ] Deploy to Vercel
- [ ] Set up custom domain (optional)