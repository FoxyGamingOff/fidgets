import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
      { title: "Spiral Cone — Jouet 3D à 2 $" },
      { name: "description", content: "Commande ton jouet 3D imprimé — design spirale unique. 2 $." },
    ],
  }),
});

const orderSchema = z.object({
  first_name: z.string().trim().min(1, "Prénom requis").max(60),
  last_name: z.string().trim().min(1, "Nom requis").max(60),
  class_group: z.string().trim().min(1, "Groupe-classe requis").max(40),
  more_details: z.string().trim().max(500).optional(),
});

function Index() {
  const [form, setForm] = useState({ first_name: "", last_name: "", class_group: "", more_details: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = orderSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("orders").insert({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      class_group: parsed.data.class_group,
      more_details: parsed.data.more_details || null,
    });
    setLoading(false);
    if (error) {
      toast.error("Erreur. Réessaie.");
      return;
    }
    setDone(true);
    setForm({ first_name: "", last_name: "", class_group: "", more_details: "" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-center" />
      <header className="absolute top-0 right-0 p-6 z-10">
        <Link to="/admin" className="text-sm text-muted-foreground hover:text-primary transition">Admin</Link>
      </header>

      <main className="container mx-auto px-6 py-16 lg:py-24 grid lg:grid-cols-2 gap-16 items-center max-w-6xl">
        {/* Hero */}
        <section>
          <div className="inline-block px-3 py-1 rounded-full border border-border text-xs uppercase tracking-widest text-muted-foreground mb-6">
            Édition limitée • Imprimé 3D
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold leading-tight tracking-tight mb-6">
            Spiral
            <span className="block bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-hero)" }}>
              Cone
            </span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-md">
            Un cône spirale hypnotique, imprimé en 3D avec un dégradé violet-rose-noir. Léger, satisfaisant à manipuler.
          </p>
          <div className="flex items-baseline gap-3 mb-8">
            <span className="text-5xl font-bold" style={{ background: "var(--gradient-hero)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>2 $</span>
            <span className="text-muted-foreground">/ unité</span>
          </div>
          <div className="relative rounded-2xl overflow-hidden border border-border" style={{ boxShadow: "var(--shadow-glow)" }}>
            <img src={toyImage} alt="Jouet 3D Spiral Cone violet et noir" className="w-full h-80 object-cover" />
          </div>
        </section>

        {/* Form */}
        <section>
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
                  <h2 className="text-2xl font-bold mb-1">Passer une commande</h2>
                  <p className="text-sm text-muted-foreground">Aucun paiement en ligne — règle sur place.</p>
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
                <Button type="submit" disabled={loading} className="w-full text-base py-6" style={{ background: "var(--gradient-hero)", color: "oklch(0.97 0.01 300)" }}>
                  {loading ? "Envoi..." : "Confirmer la commande"}
                </Button>
              </form>
            )}
          </Card>
        </section>
      </main>
    </div>
  );
}
