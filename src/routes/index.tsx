import { createFileRoute, Link } from "@tanstack/react-router";
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
};

type CartItem = { product: Product; qty: number };

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
  const [cart, setCart] = useState<CartItem[]>([]);
  const [form, setForm] = useState({ first_name: "", last_name: "", class_group: "", more_details: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const [sug, setSug] = useState({ fidget_name: "", description: "", submitter_name: "" });
  const [sugLoading, setSugLoading] = useState(false);
  const [sugDone, setSugDone] = useState(false);

  useEffect(() => {
    supabase.from("products").select("*").eq("active", true).order("created_at", { ascending: true }).then(({ data }) => {
      setProducts((data as Product[]) ?? []);
    });
  }, []);

  const total = useMemo(() => cart.reduce((s, i) => s + Number(i.product.price) * i.qty, 0), [cart]);
  const itemCount = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);

  function addToCart(p: Product) {
    setCart((c) => {
      const ex = c.find((i) => i.product.id === p.id);
      if (ex) return c.map((i) => (i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...c, { product: p, qty: 1 }];
    });
    toast.success(`${p.name} ajouté au panier`);
  }
  function setQty(id: string, qty: number) {
    if (qty <= 0) return setCart((c) => c.filter((i) => i.product.id !== id));
    setCart((c) => c.map((i) => (i.product.id === id ? { ...i, qty } : i)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (cart.length === 0) { toast.error("Ton panier est vide"); return; }
    const parsed = orderSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);

    const summary = cart.map((i) => `${i.qty}× ${i.product.name} (${(Number(i.product.price) * i.qty).toFixed(2)} $)`).join("\n");
    const fullDetails = `Panier:\n${summary}\nTotal: ${total.toFixed(2)} $${parsed.data.more_details ? `\n\nNote:\n${parsed.data.more_details}` : ""}`;
    const productNames = cart.map((i) => `${i.qty}× ${i.product.name}`).join(", ");

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
  }

  async function submitSuggestion(e: React.FormEvent) {
    e.preventDefault();
    const parsed = suggestionSchema.safeParse(sug);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setSugLoading(true);
    const { error } = await supabase.from("suggestions").insert({
      fidget_name: parsed.data.fidget_name,
      description: parsed.data.description || null,
      submitter_name: parsed.data.submitter_name || null,
    });
    setSugLoading(false);
    if (error) { toast.error("Erreur. Réessaie."); return; }
    setSugDone(true);
    setSug({ fidget_name: "", description: "", submitter_name: "" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-center" />
      <header className="absolute top-0 right-0 p-6 z-10 flex items-center gap-4">
        <a href="#cart" className="text-sm text-muted-foreground hover:text-primary transition">
          Panier {itemCount > 0 && <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">{itemCount}</span>}
        </a>
      </header>

      <main className="container mx-auto px-6 py-16 max-w-6xl">
        {/* Hero */}
        <section className="text-center mb-16">
          <div className="inline-block px-3 py-1 rounded-full border border-border text-xs uppercase tracking-widest text-muted-foreground mb-6">
            Imprimé 3D • Édition limitée
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold leading-tight tracking-tight mb-6">
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-hero)" }}>
              ​3D PRINTS{"\n"}
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Ajoute des fidgets au panier, place ta commande, règle sur place.
          </p>
        </section>

        {/* Catalog */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold mb-6">Catalogue</h2>
          {products.length === 0 && (
            <p className="text-muted-foreground text-sm">Aucun fidget pour l'instant.</p>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((p) => {
              const inCart = cart.find((i) => i.product.id === p.id);
              return (
                <Card key={p.id} className="p-4 bg-card border-border transition hover:border-primary/50">
                  <div className="aspect-square rounded-lg overflow-hidden mb-4 bg-muted">
                    <img src={p.image_url || toyImage} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold">{p.name}</h3>
                    <span className="font-bold whitespace-nowrap" style={{ background: "var(--gradient-hero)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{Number(p.price).toFixed(2)} $</span>
                  </div>
                  {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
                  <Button size="sm" onClick={() => addToCart(p)} className="w-full mt-4" style={{ background: "var(--gradient-hero)", color: "oklch(0.97 0.01 300)" }}>
                    {inCart ? `Ajouter encore (${inCart.qty})` : "Ajouter au panier"}
                  </Button>
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
                      {cart.map((i) => (
                        <div key={i.product.id} className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-muted overflow-hidden shrink-0">
                            <img src={i.product.image_url || toyImage} alt={i.product.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{i.product.name}</p>
                            <p className="text-xs text-muted-foreground">{Number(i.product.price).toFixed(2)} $ × {i.qty}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setQty(i.product.id, i.qty - 1)}>−</Button>
                            <span className="w-6 text-center text-sm">{i.qty}</span>
                            <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setQty(i.product.id, i.qty + 1)}>+</Button>
                          </div>
                        </div>
                      ))}
                      <div className="border-t border-border pt-2 mt-2 flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total</span>
                        <span className="text-xl font-bold" style={{ background: "var(--gradient-hero)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                          {total.toFixed(2)} $
                        </span>
                      </div>
                    </>
                  )}
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
                  <Label htmlFor="md">Plus de détails — précise la taille souhaitée</Label>
                  <Textarea id="md" placeholder="Ex: taille moyenne, couleur bleue... ⚠️ Plus c'est gros, plus c'est cher !" value={form.more_details} onChange={(e) => setForm({ ...form, more_details: e.target.value })} maxLength={500} rows={3} />
                  <p className="text-xs text-muted-foreground mt-1">Indique la taille que tu veux (petit / moyen / gros). Plus le fidget est gros, plus il coûte cher.</p>
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
