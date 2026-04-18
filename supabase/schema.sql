-- ============================================
-- ListMais — Schema SQL para Supabase (FIXED)
-- Execute este SQL no SQL Editor do Supabase
-- ============================================

-- ============================================
-- 1. Criação de todas as tabelas
-- ============================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL DEFAULT substr(md5(random()::text), 1, 8),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE household_members (
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (household_id, user_id)
);

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📦',
  sort_order INT DEFAULT 0
);

CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  in_stock BOOLEAN DEFAULT FALSE,
  quantity NUMERIC DEFAULT 1,
  unit TEXT DEFAULT 'Un',
  previous_price NUMERIC(10,2),
  current_price NUMERIC(10,2),
  checked BOOLEAN DEFAULT FALSE,
  checked_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  finalized_by UUID REFERENCES profiles(id),
  total NUMERIC(10,2),
  items_count INT,
  finalized_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID REFERENCES purchases(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  category_name TEXT,
  quantity NUMERIC,
  unit TEXT,
  price NUMERIC(10,2),
  subtotal NUMERIC(10,2)
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('stock_out', 'list_ready', 'price_up', 'member_joined', 'purchase_done')),
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  related_item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 2. Habilitar RLS em todas as tabelas
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. Políticas de Segurança (Row Level Security)
-- ============================================

-- Profiles
CREATE POLICY "Users can view profiles of household members" ON profiles FOR SELECT
  USING (
    id = auth.uid() OR
    id IN (SELECT hm.user_id FROM household_members hm WHERE hm.household_id IN (SELECT hm2.household_id FROM household_members hm2 WHERE hm2.user_id = auth.uid()))
  );

CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (id = auth.uid());


-- Households
CREATE POLICY "Members can view their households" ON households FOR SELECT
  USING (id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated users can find households by invite code" ON households FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create households" ON households FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update their households" ON households FOR UPDATE
  USING (id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid() AND role = 'admin'));


-- Household Members
CREATE POLICY "Members can view household members" ON household_members FOR SELECT
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated users can join households" ON household_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage members" ON household_members FOR DELETE
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid() AND role = 'admin'));


-- Categories
CREATE POLICY "Members can view categories" ON categories FOR SELECT
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));

CREATE POLICY "Members can insert categories" ON categories FOR INSERT
  WITH CHECK (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));

CREATE POLICY "Members can update categories" ON categories FOR UPDATE
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins can delete categories" ON categories FOR DELETE
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid() AND role = 'admin'));


-- Items
CREATE POLICY "Members can view items" ON items FOR SELECT
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));

CREATE POLICY "Members can insert items" ON items FOR INSERT
  WITH CHECK (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));

CREATE POLICY "Members can update items" ON items FOR UPDATE
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));

CREATE POLICY "Members can delete items" ON items FOR DELETE
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));


-- Purchases
CREATE POLICY "Members can view purchases" ON purchases FOR SELECT
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));

CREATE POLICY "Members can insert purchases" ON purchases FOR INSERT
  WITH CHECK (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));


-- Purchase Items
CREATE POLICY "Members can view purchase items" ON purchase_items FOR SELECT
  USING (purchase_id IN (SELECT id FROM purchases WHERE household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())));

CREATE POLICY "Members can insert purchase items" ON purchase_items FOR INSERT
  WITH CHECK (purchase_id IN (SELECT id FROM purchases WHERE household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())));


-- Notifications
CREATE POLICY "Users can view their notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Members can create notifications for household" ON notifications FOR INSERT
  WITH CHECK (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));
CREATE POLICY "Users can update their own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own notifications" ON notifications FOR DELETE USING (user_id = auth.uid());


-- ============================================
-- 4. Triggers e Funções Auxiliares
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Se o trigger já existir vai dar erro na criação caso usemos CREATE. Usamos DROP antes.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS items_updated_at ON items;
CREATE TRIGGER items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 5. Enable Realtime
-- ============================================

-- Executa num bloco DO para não falhar caso as tabelas já estejam no publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE items;
  EXCEPTION WHEN undefined_object THEN NULL; WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  EXCEPTION WHEN undefined_object THEN NULL; WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE household_members;
  EXCEPTION WHEN undefined_object THEN NULL; WHEN duplicate_object THEN NULL; END;
END $$;
