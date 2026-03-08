-- ==========================================
-- Room Chat Table
-- ==========================================

CREATE TABLE IF NOT EXISTS public.room_chat (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  canvas_id UUID NOT NULL REFERENCES public.canvases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_room_chat_canvas_id ON public.room_chat(canvas_id);
CREATE INDEX IF NOT EXISTS idx_room_chat_created_at ON public.room_chat(created_at);

-- RLS Setup
ALTER TABLE public.room_chat ENABLE ROW LEVEL SECURITY;

-- Select policy: User can read messages if they are authenticated
CREATE POLICY "Users can view messages" 
ON public.room_chat FOR SELECT 
TO authenticated
USING (true);

-- Insert policy: User can send messages if they are authenticated
CREATE POLICY "Users can send messages" 
ON public.room_chat FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() = user_id
);

-- Adding it to publications for realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_chat;
