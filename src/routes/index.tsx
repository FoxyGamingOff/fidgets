import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
};

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
  const [selected, setSelected] = useState<Product | null>(null);
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) { toast.error("Choisis un fidget"); return; }
    const parsed = orderSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.from("orders").insert({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      class_group: parsed.data.class_group,
      more_details: parsed.data.more_details || null,
      product_id: selected.id,
      product_name: selected.name,
    });
    setLoading(false);
    if (error) { toast.error("Erreur. Réessaie."); return; }
    setDone(true);
    setForm({ first_name: "", last_name: "", class_group: "", more_details: "" });
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
      <header className="absolute top-0 right-0 p-6 z-10">
        <Link to="/admin" className="text-sm text-muted-foreground hover:text-primary transition">Admin</Link>
      </header>

      <main className="container mx-auto px-6 py-16 max-w-6xl">
        {/* Hero */}
        <section className="text-center mb-16">
          <div className="inline-block px-3 py-1 rounded-full border border-border text-xs uppercase tracking-widest text-muted-foreground mb-6">
            Imprimé 3D • Édition limitée
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold leading-tight tracking-tight mb-6">
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-hero)" }}>
              Fidgets
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Choisis un fidget, place ta commande, règle sur place.
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
              const isSelected = selected?.id === p.id;
              return (
                <Card key={p.id} className={`p-4 bg-card border-border transition cursor-pointer ${isSelected ? "ring-2 ring-primary" : "hover:border-primary/50"}`} onClick={() => { setSelected(p); setDone(false); document.getElementById("order-form")?.scrollIntoView({ behavior: "smooth" }); }}>
                  <div className="aspect-square rounded-lg overflow-hidden mb-4 bg-muted">
                    <img src={p.image_url || toyImage} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold">{p.name}</h3>
                    <span className="font-bold whitespace-nowrap" style={{ background: "var(--gradient-hero)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{Number(p.price).toFixed(2)} $</span>
                  </div>
                  {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
                  <Button size="sm" variant={isSelected ? "default" : "outline"} className="w-full mt-4">
                    {isSelected ? "Sélectionné ✓" : "Commander"}
                  </Button>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Order Form */}
        <section id="order-form" className="grid lg:grid-cols-2 gap-10 mb-20">
          <Card className="p-8 bg-card border-border">
            {done ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">✨</div>
                <h2 className="text-2xl font-bold mb-2">Commande reçue !</h2>
                <p className="text-muted-foreground mb-6">On te contacte bientôt pour la livraison.</p>
                <Button onClick={() => { setDone(false); setSelected(null); }} variant="outline">Nouvelle commande</Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Passer une commande</h2>
                  <p className="text-sm text-muted-foreground">
                    {selected ? <>Fidget choisi : <span className="text-primary font-semibold">{selected.name}</span></> : "Choisis un fidget dans le catalogue ci-dessus."}
                  </p>
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
                  <Label htmlFor="md">Plus de détails</Label>
                  <Textarea id="md" placeholder="Quantité, couleur préférée, etc." value={form.more_details} onChange={(e) => setForm({ ...form, more_details: e.target.value })} maxLength={500} rows={4} />
                </div>
                <Button type="submit" disabled={loading || !selected} className="w-full text-base py-6" style={{ background: "var(--gradient-hero)", color: "oklch(0.97 0.01 300)" }}>
                  {loading ? "Envoi..." : "Confirmer la commande"}
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
