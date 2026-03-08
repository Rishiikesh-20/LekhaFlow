-- ==========================================
-- RBAC Dashboard and System
-- ==========================================

-- System Roles Lookup Table
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  level INTEGER NOT NULL DEFAULT 0, -- Higher number = more privileges
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Default Roles
INSERT INTO public.roles (name, description, level) VALUES
('viewer', 'Can only view canvases', 10),
('editor', 'Can view and edit canvases', 50),
('admin', 'Full access to room management & users', 100)
ON CONFLICT (name) DO NOTHING;

-- User Roles Table (Global System Privileges)
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, role_id)
);

-- RLS Setup for roles
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Select policies
CREATE POLICY "Anyone can view roles" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can view user roles" ON public.user_roles FOR SELECT TO authenticated USING (true);

-- Insert/Update Policy for user_roles (only super admins)
CREATE POLICY "Only admins can manage user roles" ON public.user_roles 
FOR ALL TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name = 'admin'
  )
);
