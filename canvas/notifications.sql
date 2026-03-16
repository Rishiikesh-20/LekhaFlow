-- ============================================================================
-- LEKHAFLOW - NOTIFICATIONS SCHEMA
-- ============================================================================
-- Execute this script in your Supabase SQL Editor to create the notifications tables
-- and types needed for Story 3.4
-- ============================================================================

CREATE TYPE notification_type AS ENUM ('mention', 'invite', 'system', 'comment');

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    canvas_id UUID REFERENCES public.canvases(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Turn on Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Allow users to view only their own notifications
CREATE POLICY "Users can view their own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

-- Allow backend service role to insert/update notifications
-- Since the HTTP backend uses SERVICE_ROLE key typically, it bypasses RLS anyway, 
-- but users can also dismiss their own notifications directly if needed:
CREATE POLICY "Users can update their own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Enable real-time replication for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
