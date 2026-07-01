alter table public.services enable row level security;
alter table public.testimonials enable row level security;
alter table public.gallery_items enable row level security;
alter table public.service_areas enable row level security;
alter table public.quote_requests enable row level security;
alter table public.admin_settings enable row level security;
alter table public.feedback_messages enable row level security;

-- Recommended:
-- Set SUPABASE_SERVICE_ROLE_KEY in .env.local for the server.
-- The backend already prefers the service-role key when present, so the app
-- can keep working through RLS while anonymous browser access stays blocked.