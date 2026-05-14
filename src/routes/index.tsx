import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import toyImage from "@/assets/toy.jpeg";
import { SIZES, sizeLabel, sizeMultiplier, type SizeKey } from "@/lib/sizes";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Fidgets — Jouets 3D imprimés" },
      { name: "description", content: "Commande des fidgets imprimés en 3D. Aucun paiement en ligne — règle sur place." },
    ],
  }),
});

type Product = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  description: string | null;
  discount_percent?: number | null;
  is_star?: boolean | null;
  coming_soon?: boolean | null;
  preorder_enabled?: boolean | null;
  position?: number | null;
  stock_status?: string | null;
  stock_qty?: number | null;
};

type CouponPub = {
  code: string;
  discount_percent: number;
  active: boolean;
  show_on_home: boolean;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
};

const PREORDER_FEE = 0.5;

function discountedBase(p: Pick<Product, "price" | "discount_percent">) {
  return Number(p.price) * (1 - Number(p.discount_percent || 0) / 100);
}

type CartItem = { product: Product; size: SizeKey; qty: number; preorder?: boolean };

function lineUnitPrice(i: CartItem) {
  // Order: base × size, then product discount already applied via discountedBase, plus preorder fee
  return discountedBase(i.product) * sizeMultiplier(i.size) + (i.preorder ? PREORDER_FEE : 0);
}

const orderSchema = z.object({
  first_name: z.string().trim().min(1, "Prénom requis").max(60),
  last_name: z.string().trim().min(1, "Nom requis").max(60),
  class_group: z.string().trim().min(1, "Groupe-classe requis").max(40),
  more_details: z.string().trim().max(500).optional(),
});

const suggestionSchema = z.object({
  fidget_name: z.string().trim().min(1, "Nom requis").max(80),
  description: z.string().trim().max(500).optional(),
  submitter_name: z.string().trim().max(60).optional(),
});

function Index() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{ first_name: string; last_name: string; class_group: string } | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [tiers, setTiers] = useState<{ min_qty: number; discount_percent: number }[]>([]);
  const [homeCoupons, setHomeCoupons] = useState<CouponPub[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [form, setForm] = useState({ first_name: "", last_name: "", class_group: "", more_details: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Per-product selected size (default normal)
  const [sizeChoice, setSizeChoice] = useState<Record<string, SizeKey>>({});

  // Coupon
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount_percent: number } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  // Suggestion
  const [sug, setSug] = useState({ fidget_name: "", description: "", submitter_name: "" });
  const [sugFile, setSugFile] = useState<File | null>(null);
  const [sugLoading, setSugLoading] = useState(false);
  const [sugDone, setSugDone] = useState(false);

  // Auth
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) { setProfile(null); return; }
    supabase.from("profiles").select("first_name,last_name,class_group").eq("id", session.user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProfile(data);
          setForm((f) => ({ ...f, first_name: data.first_name, last_name: data.last_name, class_group: data.class_group }));
        }
      });
  }, [session]);

  useEffect(() => {
    supabase.from("products").select("*").eq("active", true).then(({ data }) => {
      const list = (data as Product[]) ?? [];
      // Sort: stars first, then by position asc, then created_at
      list.sort((a, b) => {
        if (!!b.is_star !== !!a.is_star) return b.is_star ? 1 : -1;
        return Number(a.position ?? 0) - Number(b.position ?? 0);
      });
      setProducts(list);
    });
    supabase.from("bundle_tiers").select("min_qty,discount_percent").order("min_qty", { ascending: true }).then(({ data }) => {
      setTiers((data as { min_qty: number; discount_percent: number }[]) ?? []);
    });
    supabase.from("coupons").select("code,discount_percent,active,show_on_home,max_uses,uses_count,expires_at")
      .eq("active", true).eq("show_on_home", true).then(({ data }) => {
        const now = Date.now();
        const valid = ((data as CouponPub[]) ?? []).filter((c) =>
          (c.max_uses === null || c.uses_count < c.max_uses) &&
          (!c.expires_at || new Date(c.expires_at).getTime() > now)
        );
        setHomeCoupons(valid);
      });
  }, []);

  const subtotal = useMemo(() => cart.reduce((s, i) => s + lineUnitPrice(i) * i.qty, 0), [cart]);
  const itemCount = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);
  const bundleTier = useMemo(() => {
    const eligible = tiers.filter((t) => itemCount >= t.min_qty);
    if (eligible.length === 0) return null;
    return eligible.reduce((best, t) => (Number(t.discount_percent) > Number(best.discount_percent) ? t : best));
  }, [tiers, itemCount]);
  const bundleDiscount = bundleTier ? subtotal * (Number(bundleTier.discount_percent) / 100) : 0;
  const afterBundle = subtotal - bundleDiscount;
  const couponDiscount = coupon ? afterBundle * (Number(coupon.discount_percent) / 100) : 0;
  const total = afterBundle - couponDiscount;

  function getSize(p: Product): SizeKey { return sizeChoice[p.id] ?? "normal"; }

  function addToCart(p: Product, opts?: { preorder?: boolean }) {
    const size = getSize(p);
    setCart((c) => {
      const ex = c.find((i) => i.product.id === p.id && i.size === size && !!i.preorder === !!opts?.preorder);
      if (ex) return c.map((i) => (i === ex ? { ...i, qty: i.qty + 1 } : i));
      return [...c, { product: p, size, qty: 1, preorder: !!opts?.preorder }];
    });
    toast.success(`${p.name} (${sizeLabel(size)}) ajouté${opts?.preorder ? " — précommande" : ""}`);
  }
  function setQty(idx: number, qty: number) {
    if (qty <= 0) return setCart((c) => c.filter((_, i) => i !== idx));
    setCart((c) => c.map((i, ix) => (ix === idx ? { ...i, qty } : i)));
  }

  async function applyCoupon() {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    setCouponBusy(true);
    const { data, error } = await supabase.from("coupons")
      .select("code,discount_percent,active,max_uses,uses_count,expires_at")
      .eq("code", code).eq("active", true).maybeSingle();
    setCouponBusy(false);
    if (error || !data) return toast.error("Code invalide");
    if (data.max_uses !== null && data.uses_count >= data.max_uses) return toast.error("Coupon épuisé");
    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return toast.error("Coupon expiré");
    setCoupon({ code: data.code, discount_percent: Number(data.discount_percent) });
    toast.success(`Coupon ${data.code} appliqué (−${Number(data.discount_percent)}%)`);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (cart.length === 0) return toast.error("Ton panier est vide");
    const parsed = orderSchema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);

    const summary = cart.map((i) =>
      `${i.qty}× ${i.product.name} [${sizeLabel(i.size)} ${Math.round(sizeMultiplier(i.size) * 100)}%]${i.preorder ? " [PRÉCMD +0.50$]" : ""} (${(lineUnitPrice(i) * i.qty).toFixed(2)} $)`
    ).join("\n");
    const bundleLine = bundleTier ? `\nPack ≥${bundleTier.min_qty} items: −${Number(bundleTier.discount_percent)}% (−${bundleDiscount.toFixed(2)} $)` : "";
    const couponLine = coupon ? `\nCoupon ${coupon.code}: −${Number(coupon.discount_percent)}% (−${couponDiscount.toFixed(2)} $)` : "";
    const fullDetails = `Panier:\n${summary}${bundleLine}${couponLine}\nTotal: ${total.toFixed(2)} $${parsed.data.more_details ? `\n\nNote:\n${parsed.data.more_details}` : ""}`;
    const productNames = cart.map((i) => `${i.qty}× ${i.product.name} (${sizeLabel(i.size)})${i.preorder ? " (précmd)" : ""}`).join(", ");

    const { error } = await supabase.from("orders").insert({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      class_group: parsed.data.class_group,
      more_details: fullDetails,
      product_id: cart[0].product.id,
      product_name: productNames,
      user_id: session?.user.id ?? null,
      coupon_code: coupon?.code ?? null,
    });
    if (!error && coupon?.code) {
      await supabase.rpc("increment_coupon_use", { _code: coupon.code });
    }
    setLoading(false);
    if (error) return toast.error("Erreur. Réessaie.");
    setDone(true);
    if (!profile) setForm({ first_name: "", last_name: "", class_group: "", more_details: "" });
    else setForm({ ...form, more_details: "" });
    setCart([]);
    setCoupon(null);
    setCouponCode("");
  }

  async function submitSuggestion(e: React.FormEvent) {
    e.preventDefault();
    const parsed = suggestionSchema.safeParse(sug);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSugLoading(true);
    let image_url: string | null = null;
    if (sugFile) {
      const ext = sugFile.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("suggestion-images").upload(path, sugFile);
      if (upErr) { setSugLoading(false); return toast.error("Image: " + upErr.message); }
      image_url = supabase.storage.from("suggestion-images").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.from("suggestions").insert({
      fidget_name: parsed.data.fidget_name,
      description: parsed.data.description || null,
      submitter_name: parsed.data.submitter_name || null,
      image_url,
    });
    setSugLoading(false);
    if (error) return toast.error("Erreur. Réessaie.");
    setSugDone(true);
    setSug({ fidget_name: "", description: "", submitter_name: "" });
    setSugFile(null);
  }

  const reqStar = <span className="text-destructive ml-0.5">*</span>;
  const fieldsLocked = !!profile;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-center" />

      {/* School notice banner */}
      <div className="bg-amber-500/15 border-b border-amber-500/40 text-center px-4 py-2 text-xs sm:text-sm">
        <span className="font-semibold text-amber-300">⚠️ Avis :</span>{" "}
        <span className="text-foreground/90">la vente de fidgets n'est pas autorisée à l'intérieur du bâtiment de l'école, mais elle est permise à l'extérieur.</span>
      </div>

      {/* Coupon banner */}
      {homeCoupons.length > 0 && (
        <div className="bg-primary/10 border-b border-primary/30 px-4 py-2 text-center text-xs sm:text-sm flex flex-wrap gap-2 justify-center items-center">
          <span className="font-semibold text-primary">🎟️ Codes promo :</span>
          {homeCoupons.map((c) => (
            <span key={c.code} className="px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-mono">
              {c.code} −{Number(c.discount_percent)}%
            </span>
          ))}
        </div>
      )}

      {/* Top right nav */}
      <header className="absolute top-16 right-0 p-6 z-10 flex items-center gap-4 flex-wrap justify-end max-w-full">
        <a href="#cart" className="text-sm text-muted-foreground hover:text-primary transition">
          Panier {itemCount > 0 && <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">{itemCount}</span>}
        </a>
        <Link to="/commandes" className="text-sm text-muted-foreground hover:text-primary transition">Commandes</Link>
        <Link to="/compte" className="text-sm text-muted-foreground hover:text-primary transition">
          {session ? "Mon compte" : "Compte"}
        </Link>
      </header>

      <main className="container mx-auto px-6 py-16 max-w-6xl">
        {/* Hero */}
        <section className="text-center mb-8">
          <div className="inline-block px-3 py-1 rounded-full border border-border text-xs uppercase tracking-widest text-muted-foreground mb-6">
            Imprimé 3D • Édition limitée
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold leading-tight tracking-tight mb-6">
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-hero)" }}>
              ​3D PRINTS
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Ajoute des fidgets au panier, place ta commande, règle sur place.
          </p>
        </section>

        {/* Account hint */}
        {!session && (
          <p className="text-center text-sm text-muted-foreground mb-8">
            💡 <Link to="/compte" className="text-primary underline">Crée un compte</Link> pour ne plus avoir à entrer ton prénom, ton nom et ton groupe-classe à chaque commande.
          </p>
        )}

        {/* Sizing info */}
        <section className="mb-12">
          <Card className="p-5 bg-card border-border max-w-3xl mx-auto">
            <h3 className="font-semibold mb-2">📐 Choix de taille</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Chaque fidget peut être imprimé en 5 tailles. Le prix est ajusté automatiquement&nbsp;:
              <span className="text-foreground font-medium"> prix de base × pourcentage de taille</span>, puis on applique le rabais s'il y en a un.
            </p>
            <ul className="text-sm grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
              {SIZES.map((s) => (
                <li key={s.key} className="px-2 py-1 rounded border border-border text-center">
                  <span className="block text-foreground font-medium">{s.label}</span>
                  <span className="text-xs text-muted-foreground">{Math.round(s.multiplier * 100)}%</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground mt-3">
              Exemple&nbsp;: un fidget à 4&nbsp;$ en taille <span className="text-foreground">Moyen (160%)</span> coûte
              <span className="text-foreground font-medium"> 1.6 × 4&nbsp;$ = 6.40&nbsp;$</span>. Un rabais de −10% le ramène à 5.76&nbsp;$.
            </p>
          </Card>
        </section>

        {/* Catalog */}
        <section className="mb-20">
          <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
            <h2 className="text-2xl font-bold">Catalogue</h2>
            {tiers.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {tiers.slice().sort((a, b) => a.min_qty - b.min_qty).map((t) => (
                  <span key={t.min_qty} className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary border border-primary/30">
                    ≥{t.min_qty} items → −{Number(t.discount_percent)}%
                  </span>
                ))}
              </div>
            )}
          </div>
          {products.length === 0 && <p className="text-muted-foreground text-sm">Aucun fidget pour l'instant.</p>}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((p) => {
              const size = getSize(p);
              const inCart = cart.find((i) => i.product.id === p.id && i.size === size);
              const soon = !!p.coming_soon;
              const preorder = soon && !!p.preorder_enabled;
              const stockStatus = p.stock_status ?? "in_stock";
              const outOfStock = stockStatus === "out_of_stock";
              const inProduction = stockStatus === "in_production";
              const linePrice = discountedBase(p) * sizeMultiplier(size);
              return (
                <Card key={p.id} className={`p-4 bg-card border-border transition hover:border-primary/50 relative ${p.is_star ? "ring-2 ring-amber-400/60" : ""}`}>
                  {p.is_star && (
                    <span className="absolute -top-2 -left-2 z-10 px-2 py-1 rounded-full bg-amber-400 text-amber-950 text-[10px] font-bold shadow">⭐ POPULAIRE</span>
                  )}
                  {soon && (
                    <span className="absolute -top-2 -right-2 z-10 px-2 py-1 rounded-full bg-blue-500 text-white text-[10px] font-bold shadow">BIENTÔT</span>
                  )}
                  <div className="aspect-square rounded-lg overflow-hidden mb-4 bg-muted">
                    <img src={p.image_url || toyImage} alt={p.name} className={`w-full h-full object-cover ${soon || outOfStock ? "opacity-60" : ""}`} />
                  </div>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold">{p.name}</h3>
                    <div className="flex flex-col items-end leading-tight">
                      {Number(p.discount_percent || 0) > 0 && (
                        <span className="text-xs text-muted-foreground line-through">{(Number(p.price) * sizeMultiplier(size)).toFixed(2)} $</span>
                      )}
                      <span className="font-bold whitespace-nowrap" style={{ background: "var(--gradient-hero)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                        {linePrice.toFixed(2)} $
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-2">
                    {Number(p.discount_percent || 0) > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/20 text-primary">−{Number(p.discount_percent)}%</span>
                    )}
                    {outOfStock && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-destructive/20 text-destructive">Rupture de stock</span>}
                    {inProduction && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">En production</span>}
                    {!outOfStock && !inProduction && p.stock_qty !== null && p.stock_qty !== undefined && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">{p.stock_qty} en stock</span>
                    )}
                  </div>

                  {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}

                  {/* Size selector */}
                  <div className="mt-3">
                    <Label htmlFor={`sz-${p.id}`} className="text-xs">Taille</Label>
                    <select
                      id={`sz-${p.id}`}
                      className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={size}
                      onChange={(e) => setSizeChoice({ ...sizeChoice, [p.id]: e.target.value as SizeKey })}
                    >
                      {SIZES.map((s) => (
                        <option key={s.key} value={s.key}>{s.label} — {Math.round(s.multiplier * 100)}%</option>
                      ))}
                    </select>
                  </div>

                  {soon ? (
                    preorder ? (
                      <Button size="sm" onClick={() => addToCart(p, { preorder: true })} className="w-full mt-4" variant="outline">
                        Précommander (+0.50&nbsp;$)
                      </Button>
                    ) : (
                      <Button size="sm" disabled className="w-full mt-4" variant="outline">Bientôt disponible</Button>
                    )
                  ) : outOfStock ? (
                    <Button size="sm" disabled className="w-full mt-4" variant="outline">Rupture de stock</Button>
                  ) : (
                    <Button size="sm" onClick={() => addToCart(p)} className="w-full mt-4" style={{ background: "var(--gradient-hero)", color: "oklch(0.97 0.01 300)" }}>
                      {inCart ? `Ajouter encore (${inCart.qty})` : "Ajouter au panier"}
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        </section>

        {/* Cart + Order Form */}
        <section id="cart" className="grid lg:grid-cols-2 gap-10 mb-20">
          <Card className="p-8 bg-card border-border">
            {done ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">✨</div>
                <h2 className="text-2xl font-bold mb-2">Commande reçue !</h2>
                <p className="text-muted-foreground mb-6">
                  {session ? <>Tu peux la suivre dans <Link to="/commandes" className="text-primary underline">Mes commandes</Link>.</> : "On te contacte bientôt pour la livraison."}
                </p>
                <Button onClick={() => setDone(false)} variant="outline">Nouvelle commande</Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Panier</h2>
                  <p className="text-sm text-muted-foreground">
                    {fieldsLocked ? "Tes infos sont déjà remplies depuis ton compte." : "Vérifie ta commande puis remplis le formulaire."}
                  </p>
                </div>

                <div className="space-y-2 border border-border rounded-lg p-3 bg-background/40">
                  {cart.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Panier vide. Ajoute des fidgets ci-dessus.</p>
                  ) : (
                    <>
                      {cart.map((i, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-muted overflow-hidden shrink-0">
                            <img src={i.product.image_url || toyImage} alt={i.product.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {i.product.name} <span className="text-xs text-muted-foreground">— {sizeLabel(i.size)}</span>
                              {i.preorder && <span className="ml-1 text-[10px] text-blue-400">[PRÉCMD]</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">{lineUnitPrice(i).toFixed(2)} $ × {i.qty}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setQty(idx, i.qty - 1)}>−</Button>
                            <span className="w-6 text-center text-sm">{i.qty}</span>
                            <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setQty(idx, i.qty + 1)}>+</Button>
                          </div>
                        </div>
                      ))}
                      {bundleTier && (
                        <div className="border-t border-border pt-2 mt-2 flex justify-between items-center text-sm">
                          <span className="text-primary">Pack ≥{bundleTier.min_qty} items (−{Number(bundleTier.discount_percent)}%)</span>
                          <span className="text-primary">−{bundleDiscount.toFixed(2)} $</span>
                        </div>
                      )}
                      {coupon && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-primary">Coupon {coupon.code} (−{Number(coupon.discount_percent)}%)</span>
                          <button type="button" onClick={() => setCoupon(null)} className="text-primary">−{couponDiscount.toFixed(2)} $ ✕</button>
                        </div>
                      )}
                      <div className="border-t border-border pt-2 mt-2 flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total</span>
                        <span className="text-xl font-bold" style={{ background: "var(--gradient-hero)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                          {total.toFixed(2)} $
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Coupon input */}
                <div>
                  <Label htmlFor="cp">Code coupon</Label>
                  <div className="flex gap-2">
                    <Input id="cp" placeholder="Ex: NOEL10" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} disabled={!!coupon} />
                    {coupon ? (
                      <Button type="button" variant="outline" onClick={() => { setCoupon(null); setCouponCode(""); }}>Retirer</Button>
                    ) : (
                      <Button type="button" variant="outline" onClick={applyCoupon} disabled={couponBusy || !couponCode.trim()}>
                        {couponBusy ? "..." : "Appliquer"}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="fn">
                      Prénom {!fieldsLocked && !form.first_name.trim() && reqStar}
                    </Label>
                    <Input id="fn" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} maxLength={60} disabled={fieldsLocked} required />
                  </div>
                  <div>
                    <Label htmlFor="ln">
                      Nom de famille {!fieldsLocked && !form.last_name.trim() && reqStar}
                    </Label>
                    <Input id="ln" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} maxLength={60} disabled={fieldsLocked} required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="cg">
                    Groupe-classe {!fieldsLocked && !form.class_group.trim() && reqStar}
                  </Label>
                  <Input id="cg" placeholder="Ex: 504" value={form.class_group} onChange={(e) => setForm({ ...form, class_group: e.target.value })} maxLength={40} disabled={fieldsLocked} required />
                </div>
                {fieldsLocked && (
                  <p className="text-xs text-muted-foreground">Connecté en tant que {profile?.first_name} {profile?.last_name} ({profile?.class_group}).</p>
                )}
                <div>
                  <Label htmlFor="md">Plus de détails (facultatif)</Label>
                  <Textarea id="md" placeholder="Ex: couleur bleue, livraison à la récréation..." value={form.more_details} onChange={(e) => setForm({ ...form, more_details: e.target.value })} maxLength={500} rows={3} />
                </div>
                <Button type="submit" disabled={loading || cart.length === 0} className="w-full text-base py-6" style={{ background: "var(--gradient-hero)", color: "oklch(0.97 0.01 300)" }}>
                  {loading ? "Envoi..." : `Confirmer la commande — ${total.toFixed(2)} $`}
                </Button>
              </form>
            )}
          </Card>

          {/* Suggestion form */}
          <Card className="p-8 bg-card border-border">
            {sugDone ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">💡</div>
                <h2 className="text-2xl font-bold mb-2">Merci !</h2>
                <p className="text-muted-foreground mb-6">Ta suggestion a été envoyée.</p>
                <Button onClick={() => setSugDone(false)} variant="outline">Nouvelle suggestion</Button>
              </div>
            ) : (
              <form onSubmit={submitSuggestion} className="space-y-5">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Suggérer un fidget</h2>
                  <p className="text-sm text-muted-foreground">Une idée de nouveau jouet 3D ? Propose-la !</p>
                </div>
                <div>
                  <Label htmlFor="sn">Nom du fidget {!sug.fidget_name.trim() && reqStar}</Label>
                  <Input id="sn" value={sug.fidget_name} onChange={(e) => setSug({ ...sug, fidget_name: e.target.value })} maxLength={80} required />
                </div>
                <div>
                  <Label htmlFor="sd">Description (facultatif)</Label>
                  <Textarea id="sd" placeholder="À quoi ça ressemble, pourquoi c'est cool..." value={sug.description} onChange={(e) => setSug({ ...sug, description: e.target.value })} maxLength={500} rows={4} />
                </div>
                <div>
                  <Label htmlFor="si">Photo (facultatif)</Label>
                  <Input id="si" type="file" accept="image/*" onChange={(e) => setSugFile(e.target.files?.[0] ?? null)} />
                </div>
                <div>
                  <Label htmlFor="sm">Ton nom (facultatif)</Label>
                  <Input id="sm" value={sug.submitter_name} onChange={(e) => setSug({ ...sug, submitter_name: e.target.value })} maxLength={60} />
                </div>
                <Button type="submit" disabled={sugLoading} variant="outline" className="w-full">
                  {sugLoading ? "Envoi..." : "Envoyer la suggestion"}
                </Button>
              </form>
            )}
          </Card>
        </section>
      </main>
    </div>
  );
}
