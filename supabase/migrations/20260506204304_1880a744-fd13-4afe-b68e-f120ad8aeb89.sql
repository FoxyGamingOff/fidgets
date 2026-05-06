
ALTER TABLE public.orders ADD COLUMN product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN product_name text;

INSERT INTO public.products (name, price, image_url, description)
VALUES ('Spiral Cone', 2.00, NULL, 'Cône spirale hypnotique imprimé en 3D — dégradé violet-rose-noir.');
