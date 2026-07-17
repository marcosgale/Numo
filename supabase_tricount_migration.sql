-- ============================================================
-- TRICOUNT MIGRATION — Run this once in Supabase SQL editor
-- ============================================================

-- 1. group_members: make user_id nullable, add display_name + is_claimed
ALTER TABLE group_members ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS is_claimed  BOOLEAN NOT NULL DEFAULT TRUE;

-- Populate display_name for existing real members from their profiles
UPDATE group_members gm
SET display_name = TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')))
FROM profiles p
WHERE p.id = gm.user_id
  AND (gm.display_name IS NULL OR gm.display_name = '');

-- 2. group_expense_splits: add member_id (references group_members.id)
ALTER TABLE group_expense_splits ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES group_members(id);

-- Populate member_id for existing splits
UPDATE group_expense_splits ges
SET member_id = gm.id
FROM group_members gm, group_expenses ge
WHERE ge.id = ges.group_expense_id
  AND gm.group_id = ge.group_id
  AND gm.user_id = ges.user_id
  AND ges.member_id IS NULL;

-- 3. group_expenses: add paid_by_member_id (references group_members.id)
ALTER TABLE group_expenses ADD COLUMN IF NOT EXISTS paid_by_member_id UUID REFERENCES group_members(id);

UPDATE group_expenses ge
SET paid_by_member_id = gm.id
FROM group_members gm
WHERE gm.group_id = ge.group_id
  AND gm.user_id = ge.paid_by
  AND ge.paid_by_member_id IS NULL;

-- 4. group_settlements: add from_member_id / to_member_id, make old user_id cols nullable
ALTER TABLE group_settlements ADD COLUMN IF NOT EXISTS from_member_id UUID REFERENCES group_members(id);
ALTER TABLE group_settlements ADD COLUMN IF NOT EXISTS to_member_id   UUID REFERENCES group_members(id);
ALTER TABLE group_settlements ALTER COLUMN from_user_id DROP NOT NULL;
ALTER TABLE group_settlements ALTER COLUMN to_user_id   DROP NOT NULL;

UPDATE group_settlements gs
SET
  from_member_id = (
    SELECT id FROM group_members
    WHERE group_id = gs.group_id AND user_id = gs.from_user_id
    LIMIT 1
  ),
  to_member_id = (
    SELECT id FROM group_members
    WHERE group_id = gs.group_id AND user_id = gs.to_user_id
    LIMIT 1
  )
WHERE gs.from_member_id IS NULL;

-- ============================================================
-- RLS UPDATES (adjust if your policies differ)
-- ============================================================

-- group_members: allow reading all members of a group you belong to
-- (including placeholder members with user_id IS NULL)
DROP POLICY IF EXISTS "Members can view group members" ON group_members;
CREATE POLICY "Members can view group members" ON group_members
  FOR SELECT USING (
    group_id IN (
      SELECT group_id FROM group_members
      WHERE user_id = auth.uid()
    )
  );

-- Allow inserting placeholder members (group creator)
DROP POLICY IF EXISTS "Members can insert group members" ON group_members;
CREATE POLICY "Members can insert group members" ON group_members
  FOR INSERT WITH CHECK (
    group_id IN (
      SELECT group_id FROM group_members
      WHERE user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- Allow users to claim a placeholder slot (update user_id + is_claimed)
DROP POLICY IF EXISTS "Users can claim their member slot" ON group_members;
CREATE POLICY "Users can claim their member slot" ON group_members
  FOR UPDATE USING (
    -- Either updating their own claimed record, or claiming an unclaimed one
    user_id = auth.uid()
    OR (is_claimed = FALSE AND user_id IS NULL)
  );
