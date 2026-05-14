
-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  class_group text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins delete profiles" ON public.profiles FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- products
ALTER TABLE public.products
  ADD COLUMN position integer NOT NULL DEFAULT 0,
  ADD COLUMN stock_status text NOT NULL DEFAULT 'in_stock',
  ADD COLUMN stock_qty integer;

-- coupons
ALTER TABLE public.coupons
  ADD COLUMN max_uses integer,
  ADD COLUMN uses_count integer NOT NULL DEFAULT 0,
  ADD COLUMN expires_at timestamptz,
  ADD COLUMN show_on_home boolean NOT NULL DEFAULT false;

-- orders
ALTER TABLE public.orders
  ADD COLUMN user_id uuid,
  ADD COLUMN delivery_note text,
  ADD COLUMN coupon_code text;

CREATE POLICY "Users view own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- coupon increment fn
CREATE OR REPLACE FUNCTION public.increment_coupon_use(_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.coupons SET uses_count = uses_count + 1 WHERE code = _code;
END;
$$;
GRANT EXECUTE ON FUNCTION public.increment_coupon_use(text) TO anon, authenticated;
