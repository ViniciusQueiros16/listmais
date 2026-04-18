-- ============================================
-- CORREÇÃO: Recursão infinita em household_members
-- Execute este SQL no Supabase para corrigir
-- ============================================

-- Remove policies que causam recursão
DROP POLICY IF EXISTS "Members can view their households" ON households;
DROP POLICY IF EXISTS "Admins can update their households" ON households;
DROP POLICY IF EXISTS "Members can view household members" ON household_members;
DROP POLICY IF EXISTS "Admins can manage members" ON household_members;
DROP POLICY IF EXISTS "Members can view categories" ON categories;
DROP POLICY IF EXISTS "Members can insert categories" ON categories;
DROP POLICY IF EXISTS "Members can update categories" ON categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON categories;
DROP POLICY IF EXISTS "Members can view items" ON items;
DROP POLICY IF EXISTS "Members can insert items" ON items;
DROP POLICY IF EXISTS "Members can update items" ON items;
DROP POLICY IF EXISTS "Members can delete items" ON items;
DROP POLICY IF EXISTS "Members can view purchases" ON purchases;
DROP POLICY IF EXISTS "Members can insert purchases" ON purchases;
DROP POLICY IF EXISTS "Members can view purchase items" ON purchase_items;
DROP POLICY IF EXISTS "Members can insert purchase items" ON purchase_items;
DROP POLICY IF EXISTS "Members can create notifications for household" ON notifications;
DROP POLICY IF EXISTS "Users can view profiles of household members" ON profiles;


-- Função SECURITY DEFINER: retorna os household_ids do usuário
-- Roda com privilégios elevados, sem acionar RLS — quebra o loop
CREATE OR REPLACE FUNCTION get_my_household_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT household_id FROM household_members WHERE user_id = auth.uid();
$$;


-- Recria policies usando a função (sem recursão)

-- Profiles
CREATE POLICY "Users can view profiles of household members" ON profiles FOR SELECT
  USING (
    id = auth.uid() OR
    id IN (
      SELECT user_id FROM household_members
      WHERE household_id IN (SELECT get_my_household_ids())
    )
  );

-- Households
CREATE POLICY "Members can view their households" ON households FOR SELECT
  USING (id IN (SELECT get_my_household_ids()));

CREATE POLICY "Admins can update their households" ON households FOR UPDATE
  USING (id IN (
    SELECT household_id FROM household_members
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- Household Members: usa security definer para evitar recursão
CREATE POLICY "Members can view household members" ON household_members FOR SELECT
  USING (household_id IN (SELECT get_my_household_ids()));

CREATE POLICY "Admins can manage members" ON household_members FOR DELETE
  USING (household_id IN (
    SELECT household_id FROM household_members
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- Categories
CREATE POLICY "Members can view categories" ON categories FOR SELECT
  USING (household_id IN (SELECT get_my_household_ids()));

CREATE POLICY "Members can insert categories" ON categories FOR INSERT
  WITH CHECK (household_id IN (SELECT get_my_household_ids()));

CREATE POLICY "Members can update categories" ON categories FOR UPDATE
  USING (household_id IN (SELECT get_my_household_ids()));

CREATE POLICY "Admins can delete categories" ON categories FOR DELETE
  USING (household_id IN (
    SELECT household_id FROM household_members
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- Items
CREATE POLICY "Members can view items" ON items FOR SELECT
  USING (household_id IN (SELECT get_my_household_ids()));

CREATE POLICY "Members can insert items" ON items FOR INSERT
  WITH CHECK (household_id IN (SELECT get_my_household_ids()));

CREATE POLICY "Members can update items" ON items FOR UPDATE
  USING (household_id IN (SELECT get_my_household_ids()));

CREATE POLICY "Members can delete items" ON items FOR DELETE
  USING (household_id IN (SELECT get_my_household_ids()));

-- Purchases
CREATE POLICY "Members can view purchases" ON purchases FOR SELECT
  USING (household_id IN (SELECT get_my_household_ids()));

CREATE POLICY "Members can insert purchases" ON purchases FOR INSERT
  WITH CHECK (household_id IN (SELECT get_my_household_ids()));

-- Purchase Items
CREATE POLICY "Members can view purchase items" ON purchase_items FOR SELECT
  USING (purchase_id IN (
    SELECT id FROM purchases WHERE household_id IN (SELECT get_my_household_ids())
  ));

CREATE POLICY "Members can insert purchase items" ON purchase_items FOR INSERT
  WITH CHECK (purchase_id IN (
    SELECT id FROM purchases WHERE household_id IN (SELECT get_my_household_ids())
  ));

-- Notifications
CREATE POLICY "Members can create notifications for household" ON notifications FOR INSERT
  WITH CHECK (household_id IN (SELECT get_my_household_ids()));
