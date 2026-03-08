# 🔧 LekhaFlow Database Migrations Setup

This guide will help you set up the required database tables for Epic 3 collaboration features.

## ⚠️ Important: Run These Migrations First

Before using the collaboration features, you **must** run the following SQL migrations in your Supabase SQL Editor.

---

## 📋 Step-by-Step Instructions

### 1. Access Supabase SQL Editor

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**

### 2. Run Migration Scripts

Execute these scripts **in order**:

#### Migration 1: RBAC (Role-Based Access Control)
**File:** `canvas/rbac.sql`

```sql
-- Copy and paste the entire contents of canvas/rbac.sql
-- This creates:
-- - roles table (admin, editor, viewer)
-- - user_roles table (user-role assignments)
-- - RLS policies
```

**Features enabled:**
- ✅ Role management system
- ✅ Admin dashboard at `/rbac`
- ✅ User permission controls

---

#### Migration 2: Room Chat
**File:** `canvas/room_chat.sql`

```sql
-- Copy and paste the entire contents of canvas/room_chat.sql
-- This creates:
-- - room_chat table (chat messages)
-- - RLS policies for chat security
-- - Real-time subscriptions
```

**Features enabled:**
- ✅ In-room chat sidebar
- ✅ Real-time message delivery
- ✅ Persistent chat history

---

#### Migration 3: Notifications
**File:** `canvas/notifications.sql`

```sql
-- Copy and paste the entire contents of canvas/notifications.sql
-- This creates:
-- - notifications table
-- - notification_type enum
-- - RLS policies
-- - Real-time subscriptions
```

**Features enabled:**
- ✅ Mention notifications (`@username`)
- ✅ Notification bell in header
- ✅ Real-time notification delivery

---

## ✅ Verify Installation

After running all migrations, verify they were successful:

### Check Tables Exist

Run this query in Supabase SQL Editor:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('roles', 'user_roles', 'room_chat', 'notifications');
```

You should see all 4 tables listed.

### Check RLS is Enabled

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('roles', 'user_roles', 'room_chat', 'notifications');
```

All tables should have `rowsecurity = true`.

### Assign Admin Role (Optional)

To give yourself admin access to the RBAC dashboard:

```sql
-- Get your user ID from the auth.users table
SELECT id, email FROM auth.users;

-- Insert admin role for your user (replace YOUR_USER_ID)
INSERT INTO user_roles (user_id, role_id)
SELECT 'YOUR_USER_ID', id FROM roles WHERE name = 'admin';
```

---

## 🚀 After Setup

Once migrations are complete:

1. **Restart your development servers** (if running)
2. **Refresh your browser**
3. **Test the features:**
   - Visit `/rbac` to see the admin dashboard
   - Open a canvas and try the chat sidebar
   - Mention someone with `@username` in a text element
   - Check the notification bell 🔔

---

## 🆘 Troubleshooting

### Error: "relation does not exist"
- You haven't run the migration for that table yet
- Solution: Run the corresponding SQL migration file

### Error: "permission denied for table"
- RLS policies aren't set correctly
- Solution: Re-run the migration file (it uses `IF NOT EXISTS` and `ON CONFLICT`)

### Error: "Only admins can assign roles"
- You don't have an admin role assigned
- Solution: Run the SQL query in "Assign Admin Role" section above

### Tables exist but features don't work
- Real-time subscriptions might not be enabled
- Check that this line ran successfully in each migration:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE <table_name>;
  ```

---

## 📁 Migration File Locations

All migration files are located in the `canvas/` directory:

- `canvas/rbac.sql` - Role-based access control
- `canvas/room_chat.sql` - Chat functionality  
- `canvas/notifications.sql` - Notification system

**Total time to run all migrations: ~30 seconds**

---

## 🎯 What's Already Implemented

These features **don't** require migrations (they work via Yjs awareness):

- ✅ Invitation links (JWT-based, no DB storage)
- ✅ Laser pointer (ephemeral, awareness-only)
- ✅ Follow the leader (viewport sync via awareness)
- ✅ Object locking (stored in Yjs document)

These features are ready to use immediately without any database setup!
