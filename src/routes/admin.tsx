import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Admin — Fidgets" }] }),
});

type Order = { id: string; first_name: string; last_name: string; class_group: string; more_details: string | null; status: string; created_at: string; product_name: string | null };
type Product = { id: string; name: string; price: number; image_url: string | null; description: string | null; active: boolean };
type Suggestion = { id: string; fidget_name: string; description: string | null; submitter_name: string | null; created_at: string };

function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // New product form
  const [np, setNp] = useState({ name: "", price: "", description: "" });
  const [npFile, setNpFile] = useState<File | null>(null);
  const [npBusy, setNpBusy] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false); });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setIsAdmin(false); return; }
    supabase.from("user_roles").select("role").eq("user_id", session.user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [session]);

  useEffect(() => { if (isAdmin) loadAll(); }, [isAdmin]);

  async function loadAll() {
    const [o, p, s] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("*").order("created_at", { ascending: true }),
      supabase.from("suggestions").select("*").order("created_at", { ascending: false }),
    ]);
    setOrders((o.data as Order[]) ?? []);
    setProducts((p.data as Product[]) ?? []);
    setSuggestions((s.data as Suggestion[]) ?? []);
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/admin" } });
      if (error) toast.error(error.message); else toast.success("Compte créé.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
    }
    setBusy(false);
  }

  async function toggleStatus(id: string, current: string) {
    const next = current === "pending" ? "fulfilled" : "pending";
    const { error } = await supabase.from("orders").update({ status: next }).eq("id", id);
    if (error) return toast.error("Erreur");
    setOrders(orders.map(o => o.id === id ? { ...o, status: next } : o));
  }
  async function removeOrder(id: string) {
    if (!confirm("Supprimer cette commande ?")) return;
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) return toast.error("Erreur");
    setOrders(orders.filter(o => o.id !== id));
  }

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!np.name.trim() || !np.price) return toast.error("Nom et prix requis");
    setNpBusy(true);
    let image_url: string | null = null;
    if (npFile) {
      const ext = npFile.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, npFile);
      if (upErr) { setNpBusy(false); return toast.error("Upload image: " + upErr.message); }
      image_url = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.from("products").insert({
      name: np.name.trim(),
      price: Number(np.price),
      description: np.description.trim() || null,
      image_url,
    });
    setNpBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Fidget ajouté");
    setNp({ name: "", price: "", description: "" }); setNpFile(null);
    loadAll();
  }

  async function toggleActive(p: Product) {
    const { error } = await supabase.from("products").update({ active: !p.active }).eq("id", p.id);
    if (error) return toast.error("Erreur");
    setProducts(products.map(x => x.id === p.id ? { ...x, active: !x.active } : x));
  }
  async function removeProduct(id: string) {
    if (!confirm("Supprimer ce fidget ?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setProducts(products.filter(p => p.id !== id));
  }

  async function removeSuggestion(id: string) {
    if (!confirm("Supprimer ?")) return;
    const { error } = await supabase.from("suggestions").delete().eq("id", id);
    if (error) return toast.error("Erreur");
    setSuggestions(suggestions.filter(s => s.id !== id));
  }

  if (checking) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">…</div>;

  if (!session) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <Toaster theme="dark" position="top-center" />
        <Card className="p-8 w-full max-w-md bg-card border-border">
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary">← Retour</Link>
          <h1 className="text-3xl font-bold mt-4 mb-1">Admin</h1>
          <p className="text-sm text-muted-foreground mb-6">{mode === "signin" ? "Connexion." : "Créer un compte."}</p>
          <form onSubmit={handleAuth} className="space-y-4">
            <div><Label htmlFor="em">Courriel</Label><Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div><Label htmlFor="pw">Mot de passe</Label><Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div>
            <Button type="submit" disabled={busy} className="w-full" style={{ background: "var(--gradient-hero)", color: "oklch(0.97 0.01 300)" }}>
              {busy ? "..." : (mode === "signin" ? "Connexion" : "Créer le compte")}
            </Button>
          </form>
          <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-sm text-muted-foreground hover:text-primary mt-4 block mx-auto">
            {mode === "signin" ? "Pas de compte ? Créer" : "Déjà un compte ? Connexion"}
          </button>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <Toaster theme="dark" position="top-center" />
        <Card className="p-8 max-w-md text-center bg-card border-border">
          <h1 className="text-2xl font-bold mb-2">Accès refusé</h1>
          <p className="text-muted-foreground text-sm mb-6">Ton compte n'a pas le rôle admin.</p>
          <Button onClick={() => supabase.auth.signOut()} variant="outline">Se déconnecter</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-center" />
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary">← Site</Link>
          <h1 className="text-2xl font-bold mt-1">Admin</h1>
        </div>
        <Button onClick={() => supabase.auth.signOut()} variant="outline" size="sm">Déconnexion</Button>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-5xl">
        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders">Commandes ({orders.length})</TabsTrigger>
            <TabsTrigger value="products">Fidgets ({products.length})</TabsTrigger>
            <TabsTrigger value="suggestions">Suggestions ({suggestions.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-3 mt-6">
            {orders.length === 0 && <p className="text-muted-foreground text-center py-12">Aucune commande.</p>}
            {orders.map(o => (
              <Card key={o.id} className="p-5 bg-card border-border">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-lg font-semibold">{o.first_name} {o.last_name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground">Groupe {o.class_group}</span>
                      {o.product_name && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">{o.product_name}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${o.status === "fulfilled" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {o.status === "fulfilled" ? "Livrée" : "En attente"}
                      </span>
                    </div>
                    {o.more_details && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{o.more_details}</p>}
                    <p className="text-xs text-muted-foreground mt-2">{new Date(o.created_at).toLocaleString("fr-CA")}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => toggleStatus(o.id, o.status)}>{o.status === "pending" ? "Marquer livrée" : "Réouvrir"}</Button>
                    <Button size="sm" variant="destructive" onClick={() => removeOrder(o.id)}>Suppr.</Button>
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="products" className="space-y-6 mt-6">
            <Card className="p-6 bg-card border-border">
              <h2 className="text-lg font-semibold mb-4">Ajouter un fidget</h2>
              <form onSubmit={addProduct} className="grid sm:grid-cols-2 gap-4">
                <div><Label htmlFor="pn">Nom</Label><Input id="pn" value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} maxLength={80} required /></div>
                <div><Label htmlFor="pp">Prix ($)</Label><Input id="pp" type="number" step="0.01" min="0" value={np.price} onChange={(e) => setNp({ ...np, price: e.target.value })} required /></div>
                <div className="sm:col-span-2"><Label htmlFor="pd">Description</Label><Textarea id="pd" value={np.description} onChange={(e) => setNp({ ...np, description: e.target.value })} maxLength={300} rows={2} /></div>
                <div className="sm:col-span-2"><Label htmlFor="pi">Image</Label><Input id="pi" type="file" accept="image/*" onChange={(e) => setNpFile(e.target.files?.[0] ?? null)} /></div>
                <div className="sm:col-span-2"><Button type="submit" disabled={npBusy} style={{ background: "var(--gradient-hero)", color: "oklch(0.97 0.01 300)" }}>{npBusy ? "Ajout..." : "Ajouter"}</Button></div>
              </form>
            </Card>

            <div className="space-y-3">
              {products.map(p => (
                <Card key={p.id} className="p-4 bg-card border-border flex items-center gap-4">
                  <div className="w-16 h-16 rounded bg-muted overflow-hidden shrink-0">
                    {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{p.name}</h3>
                      <span className="text-sm text-primary font-bold">{Number(p.price).toFixed(2)} $</span>
                      {!p.active && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Caché</span>}
                    </div>
                    {p.description && <p className="text-xs text-muted-foreground truncate">{p.description}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => toggleActive(p)}>{p.active ? "Cacher" : "Activer"}</Button>
                    <Button size="sm" variant="destructive" onClick={() => removeProduct(p.id)}>Suppr.</Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="suggestions" className="space-y-3 mt-6">
            {suggestions.length === 0 && <p className="text-muted-foreground text-center py-12">Aucune suggestion.</p>}
            {suggestions.map(s => (
              <Card key={s.id} className="p-5 bg-card border-border">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{s.fidget_name}</h3>
                    {s.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{s.description}</p>}
                    <p className="text-xs text-muted-foreground mt-2">
                      {s.submitter_name ? `Par ${s.submitter_name} • ` : ""}{new Date(s.created_at).toLocaleString("fr-CA")}
                    </p>
                  </div>
                  <Button size="sm" variant="destructive" onClick={() => removeSuggestion(s.id)}>Suppr.</Button>
                </div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
