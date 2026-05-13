-- Products: star, coming soon, preorder
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_star boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coming_soon boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preorder_enabled boolean NOT NULL DEFAULT false;

-- Suggestions: image
ALTER TABLE public.suggestions ADD COLUMN IF NOT EXISTS image_url text;

-- Coupons
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_percent numeric NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active coupons" ON public.coupons
  FOR SELECT USING (active = true OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert coupons" ON public.coupons
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update coupons" ON public.coupons
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete coupons" ON public.coupons
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Storage bucket for suggestion images
INSERT INTO storage.buckets (id, name, public) VALUES ('suggestion-images', 'suggestion-images', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read suggestion images" ON storage.objects
  FOR SELECT USING (bucket_id = 'suggestion-images');
CREATE POLICY "Anyone upload suggestion images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'suggestion-images');