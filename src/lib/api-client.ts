const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const { createBrowserClient } = await import('@supabase/ssr');
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function request(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = API_BASE ? await getAuthToken() : null;
  const headers: Record<string, string> = { ...options.headers as Record<string, string> };
  if (token && !(options.body instanceof FormData)) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const url = API_BASE ? `${API_BASE}${path}` : path;
  return fetch(url, { ...options, headers });
}

export async function apiGet(path: string, params?: Record<string, string>): Promise<Response> {
  const search = params ? '?' + new URLSearchParams(params).toString() : '';
  return request(`${path}${search}`);
}

export async function apiPost(path: string, body?: any): Promise<Response> {
  const isFormData = body instanceof FormData;
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  const token = API_BASE ? await getAuthToken() : null;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const url = API_BASE ? `${API_BASE}${path}` : path;
  return fetch(url, {
    method: 'POST',
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });
}
