CREATE TABLE public.bundle_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_qty integer NOT NULL CHECK (min_qty >= 2),
  discount_percent numeric NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.bundle_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view bundle tiers" ON public.bundle_tiers FOR SELECT USING (true);
CREATE POLICY "Admins can insert bundle tiers" ON public.bundle_tiers FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update bundle tiers" ON public.bundle_tiers FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete bundle tiers" ON public.bundle_tiers FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));