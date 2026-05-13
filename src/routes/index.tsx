import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import toyImage from "@/assets/toy.jpeg";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "​Description — Jouets 3D imprimés" },
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
};

const PREORDER_FEE = 0.5;

function basePrice(p: Pick<Product, "price" | "discount_percent">) {
  return Number(p.price) * (1 - Number(p.discount_percent || 0) / 100);
}

type CartItem = { product: Product; qty: number; preorder?: boolean };

function lineUnitPrice(i: CartItem) {
  return basePrice(i.product) + (i.preorder ? PREORDER_FEE : 0);
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
  const [products, setProducts] = useState<Product[]>([]);
  const [tiers, setTiers] = useState<{ min_qty: number; discount_percent: number }[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [form, setForm] = useState({ first_name: "", last_name: "", class_group: "", more_details: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Coupon
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount_percent: number } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  // Suggestion
  const [sug, setSug] = useState({ fidget_name: "", description: "", submitter_name: "" });
  const [sugFile, setSugFile] = useState<File | null>(null);
  const [sugLoading, setSugLoading] = useState(false);
  const [sugDone, setSugDone] = useState(false);

  useEffect(() => {
    supabase.from("products").select("*").eq("active", true).order("created_at", { ascending: true }).then(({ data }) => {
      setProducts((data as Product[]) ?? []);
    });
    supabase.from("bundle_tiers").select("min_qty,discount_percent").order("min_qty", { ascending: true }).then(({ data }) => {
      setTiers((data as { min_qty: number; discount_percent: number }[]) ?? []);
    });
  }, []);

  const subtotal = useMemo(() => cart.reduce((s, i) => s + lineUnitPrice(i) * i.qty, 0), [cart]);
  const itemCount = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);
  const bundleTier = useMemo(() => {
    const eligible = tiers.filter(t => itemCount >= t.min_qty);
    if (eligible.length === 0) return null;
    return eligible.reduce((best, t) => Number(t.discount_percent) > Number(best.discount_percent) ? t : best);
  }, [tiers, itemCount]);
  const bundleDiscount = bundleTier ? subtotal * (Number(bundleTier.discount_percent) / 100) : 0;
  const afterBundle = subtotal - bundleDiscount;
  const couponDiscount = coupon ? afterBundle * (Number(coupon.discount_percent) / 100) : 0;
  const total = afterBundle - couponDiscount;

  function addToCart(p: Product, opts?: { preorder?: boolean }) {
    setCart((c) => {
      const ex = c.find((i) => i.product.id === p.id && !!i.preorder === !!opts?.preorder);
      if (ex) return c.map((i) => (i === ex ? { ...i, qty: i.qty + 1 } : i));
      return [...c, { product: p, qty: 1, preorder: !!opts?.preorder }];
    });
    toast.success(`${p.name} ajouté${opts?.preorder ? " (précommande)" : ""}`);
  }
  function setQty(idx: number, qty: number) {
    if (qty <= 0) return setCart((c) => c.filter((_, i) => i !== idx));
    setCart((c) => c.map((i, ix) => (ix === idx ? { ...i, qty } : i)));
  }

  async function applyCoupon() {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    setCouponBusy(true);
    const { data, error } = await supabase.from("coupons").select("code,discount_percent,active").eq("code", code).eq("active", true).maybeSingle();
    setCouponBusy(false);
    if (error || !data) { toast.error("Code invalide"); return; }
    setCoupon({ code: data.code, discount_percent: Number(data.discount_percent) });
    toast.success(`Coupon ${data.code} appliqué (−${Number(data.discount_percent)}%)`);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (cart.length === 0) { toast.error("Ton panier est vide"); return; }
    const parsed = orderSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);

    const summary = cart.map((i) => `${i.qty}× ${i.product.name}${i.preorder ? " [PRÉCOMMANDE +0.50$]" : ""} (${(lineUnitPrice(i) * i.qty).toFixed(2)} $)`).join("\n");
    const bundleLine = bundleTier ? `\nPack ≥${bundleTier.min_qty} items: −${Number(bundleTier.discount_percent)}% (−${bundleDiscount.toFixed(2)} $)` : "";
    const couponLine = coupon ? `\nCoupon ${coupon.code}: −${Number(coupon.discount_percent)}% (−${couponDiscount.toFixed(2)} $)` : "";
    const fullDetails = `Panier:\n${summary}${bundleLine}${couponLine}\nTotal: ${total.toFixed(2)} $${parsed.data.more_details ? `\n\nNote:\n${parsed.data.more_details}` : ""}`;
    const productNames = cart.map((i) => `${i.qty}× ${i.product.name}${i.preorder ? " (précmd)" : ""}`).join(", ");

    const { error } = await supabase.from("orders").insert({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      class_group: parsed.data.class_group,
      more_details: fullDetails,
      product_id: cart[0].product.id,
      product_name: productNames,
    });
    setLoading(false);
    if (error) { toast.error("Erreur. Réessaie."); return; }
    setDone(true);
    setForm({ first_name: "", last_name: "", class_group: "", more_details: "" });
    setCart([]);
    setCoupon(null);
    setCouponCode("");
  }

  async function submitSuggestion(e: React.FormEvent) {
    e.preventDefault();
    const parsed = suggestionSchema.safeParse(sug);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setSugLoading(true);
    let image_url: string | null = null;
    if (sugFile) {
      const ext = sugFile.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("suggestion-images").upload(path, sugFile);
      if (upErr) { setSugLoading(false); toast.error("Image: " + upErr.message); return; }
      image_url = supabase.storage.from("suggestion-images").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.from("suggestions").insert({
      fidget_name: parsed.data.fidget_name,
      description: parsed.data.description || null,
      submitter_name: parsed.data.submitter_name || null,
      image_url,
    });
    setSugLoading(false);
    if (error) { toast.error("Erreur. Réessaie."); return; }
    setSugDone(true);
    setSug({ fidget_name: "", description: "", submitter_name: "" });
    setSugFile(null);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-center" />

      {/* Secret banner */}
      <div className="bg-destructive/15 border-b border-destructive/40 text-center px-4 py-2 text-xs sm:text-sm">
        <span className="font-semibold text-destructive">⚠️ Top secret :</span>{" "}
        <span className="text-foreground/90">ne pas dire aux profs ou adultes de l'école.</span>
        <span className="hidden sm:inline text-muted-foreground"> • Contact : <a href="tel:4189994577" className="underline hover:text-primary">418-999-4577</a></span>
      </div>
      <div className="sm:hidden text-center px-4 py-1.5 text-xs text-muted-foreground border-b border-border">
        Contact : <a href="tel:4189994577" className="underline hover:text-primary">418-999-4577</a>
      </div>

      <header className="absolute top-10 right-0 p-6 z-10 flex items-center gap-4">
        <a href="#cart" className="text-sm text-muted-foreground hover:text-primary transition">
          Panier {itemCount > 0 && <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">{itemCount}</span>}
        </a>
      </header>

      <main className="container mx-auto px-6 py-16 max-w-6xl">
        {/* Hero */}
        <section className="text-center mb-12">
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

        {/* Sizing info */}
        <section className="mb-12">
          <Card className="p-5 bg-card border-border max-w-3xl mx-auto">
            <h3 className="font-semibold mb-2">📐 Tu veux une autre taille ?</h3>
            <p className="text-sm text-muted-foreground">
              Le prix d'une autre taille = <span className="text-foreground font-medium">% d'agrandissement × prix de base</span>.
              Exemple : un fidget à 4&nbsp;$ en taille <span className="text-foreground">150&nbsp;%</span> coûte
              <span className="text-foreground font-medium"> 1.5 × 4&nbsp;$ = 6&nbsp;$</span>.
              Précise le pourcentage voulu dans la note de commande.
            </p>
          </Card>
        </section>

        {/* Catalog */}
        <section className="mb-20">
          <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
            <h2 className="text-2xl font-bold">Catalogue</h2>
            {tiers.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {tiers.slice().sort((a, b) => a.min_qty - b.min_qty).map(t => (
                  <span key={t.min_qty} className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary border border-primary/30">
                    ≥{t.min_qty} items → −{Number(t.discount_percent)}%
                  </span>
                ))}
              </div>
            )}
          </div>
          {products.length === 0 && (
            <p className="text-muted-foreground text-sm">Aucun fidget pour l'instant.</p>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((p) => {
              const inCart = cart.find((i) => i.product.id === p.id);
              const soon = !!p.coming_soon;
              const preorder = soon && !!p.preorder_enabled;
              return (
                <Card key={p.id} className={`p-4 bg-card border-border transition hover:border-primary/50 relative ${p.is_star ? "ring-2 ring-amber-400/60" : ""}`}>
                  {p.is_star && (
                    <span className="absolute -top-2 -left-2 z-10 px-2 py-1 rounded-full bg-amber-400 text-amber-950 text-[10px] font-bold shadow">
                      ⭐ POPULAIRE
                    </span>
                  )}
                  {soon && (
                    <span className="absolute -top-2 -right-2 z-10 px-2 py-1 rounded-full bg-blue-500 text-white text-[10px] font-bold shadow">
                      BIENTÔT
                    </span>
                  )}
                  <div className="aspect-square rounded-lg overflow-hidden mb-4 bg-muted">
                    <img src={p.image_url || toyImage} alt={p.name} className={`w-full h-full object-cover ${soon ? "opacity-60" : ""}`} />
                  </div>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold">{p.name}</h3>
                    {Number(p.discount_percent || 0) > 0 ? (
                      <div className="flex flex-col items-end leading-tight">
                        <span className="text-xs text-muted-foreground line-through">{Number(p.price).toFixed(2)} $</span>
                        <span className="font-bold whitespace-nowrap" style={{ background: "var(--gradient-hero)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{basePrice(p).toFixed(2)} $</span>
                      </div>
                    ) : (
                      <span className="font-bold whitespace-nowrap" style={{ background: "var(--gradient-hero)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{Number(p.price).toFixed(2)} $</span>
                    )}
                  </div>
                  {Number(p.discount_percent || 0) > 0 && <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/20 text-primary mb-1">Rabais −{Number(p.discount_percent)}%</span>}
                  {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}

                  {soon ? (
                    preorder ? (
                      <Button size="sm" onClick={() => addToCart(p, { preorder: true })} className="w-full mt-4" variant="outline">
                        Précommander (+0.50&nbsp;$)
                      </Button>
                    ) : (
                      <Button size="sm" disabled className="w-full mt-4" variant="outline">Bientôt disponible</Button>
                    )
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
                <p className="text-muted-foreground mb-6">On te contacte bientôt pour la livraison.</p>
                <Button onClick={() => setDone(false)} variant="outline">Nouvelle commande</Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Panier</h2>
                  <p className="text-sm text-muted-foreground">Vérifie ta commande puis remplis le formulaire.</p>
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
                            <p className="text-sm font-medium truncate">{i.product.name}{i.preorder && <span className="ml-1 text-[10px] text-blue-400">[PRÉCMD]</span>}</p>
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
                    <Label htmlFor="fn">Prénom</Label>
                    <Input id="fn" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} maxLength={60} required />
                  </div>
                  <div>
                    <Label htmlFor="ln">Nom de famille</Label>
                    <Input id="ln" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} maxLength={60} required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="cg">Groupe-classe</Label>
                  <Input id="cg" placeholder="Ex: 504" value={form.class_group} onChange={(e) => setForm({ ...form, class_group: e.target.value })} maxLength={40} required />
                </div>
                <div>
                  <Label htmlFor="md">Plus de détails — précise la taille (% d'agrandissement)</Label>
                  <Textarea id="md" placeholder="Ex: taille 150%, couleur bleue..." value={form.more_details} onChange={(e) => setForm({ ...form, more_details: e.target.value })} maxLength={500} rows={3} />
                  <p className="text-xs text-muted-foreground mt-1">Prix taille custom = % d'agrandissement × prix de base.</p>
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
                  <Label htmlFor="sn">Nom du fidget</Label>
                  <Input id="sn" value={sug.fidget_name} onChange={(e) => setSug({ ...sug, fidget_name: e.target.value })} maxLength={80} required />
                </div>
                <div>
                  <Label htmlFor="sd">Description</Label>
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
