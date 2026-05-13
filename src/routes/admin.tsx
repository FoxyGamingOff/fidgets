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
  head: () => ({ meta: [{ title: "Admin — ​Description" }] }),
});

type Order = { id: string; first_name: string; last_name: string; class_group: string; more_details: string | null; status: string; created_at: string; product_name: string | null };
type Product = {
  id: string; name: string; price: number; image_url: string | null; description: string | null;
  active: boolean; discount_percent: number;
  is_star: boolean; coming_soon: boolean; preorder_enabled: boolean;
};
type Suggestion = { id: string; fidget_name: string; description: string | null; submitter_name: string | null; created_at: string; image_url: string | null };
type BundleTier = { id: string; min_qty: number; discount_percent: number };
type Coupon = { id: string; code: string; discount_percent: number; active: boolean };

function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [tiers, setTiers] = useState<BundleTier[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [newTier, setNewTier] = useState({ min_qty: "", discount_percent: "" });
  const [newCoupon, setNewCoupon] = useState({ code: "", discount_percent: "" });
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
    const [o, p, s, t, c] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("*").order("created_at", { ascending: true }),
      supabase.from("suggestions").select("*").order("created_at", { ascending: false }),
      supabase.from("bundle_tiers").select("*").order("min_qty", { ascending: true }),
      supabase.from("coupons").select("*").order("created_at", { ascending: false }),
    ]);
    setOrders((o.data as Order[]) ?? []);
    setProducts((p.data as Product[]) ?? []);
    setSuggestions((s.data as Suggestion[]) ?? []);
    setTiers((t.data as BundleTier[]) ?? []);
    setCoupons((c.data as Coupon[]) ?? []);
  }

  async function addTier(e: React.FormEvent) {
    e.preventDefault();
    const mq = Number(newTier.min_qty); const dp = Number(newTier.discount_percent);
    if (!Number.isInteger(mq) || mq < 2) return toast.error("Quantité min ≥ 2");
    if (isNaN(dp) || dp < 0 || dp > 100) return toast.error("Rabais 0–100");
    const { error } = await supabase.from("bundle_tiers").insert({ min_qty: mq, discount_percent: dp });
    if (error) return toast.error(error.message);
    toast.success("Pack ajouté");
    setNewTier({ min_qty: "", discount_percent: "" });
    loadAll();
  }
  async function removeTier(id: string) {
    if (!confirm("Supprimer ce pack ?")) return;
    const { error } = await supabase.from("bundle_tiers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setTiers(tiers.filter(t => t.id !== id));
  }

  async function addCoupon(e: React.FormEvent) {
    e.preventDefault();
    const code = newCoupon.code.trim().toUpperCase();
    const dp = Number(newCoupon.discount_percent);
    if (!code) return toast.error("Code requis");
    if (isNaN(dp) || dp <= 0 || dp > 100) return toast.error("Rabais 1–100");
    const { error } = await supabase.from("coupons").insert({ code, discount_percent: dp });
    if (error) return toast.error(error.message);
    toast.success(`Coupon ${code} créé`);
    setNewCoupon({ code: "", discount_percent: "" });
    loadAll();
  }
  async function toggleCoupon(c: Coupon) {
    const { error } = await supabase.from("coupons").update({ active: !c.active }).eq("id", c.id);
    if (error) return toast.error(error.message);
    setCoupons(coupons.map(x => x.id === c.id ? { ...x, active: !c.active } : x));
  }
  async function removeCoupon(id: string) {
    if (!confirm("Supprimer ce coupon ?")) return;
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setCoupons(coupons.filter(c => c.id !== id));
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
  async function archiveOrder(id: string) {
    if (!confirm("Archiver cette commande ?")) return;
    const { error } = await supabase.from("orders").update({ status: "archived" }).eq("id", id);
    if (error) return toast.error("Erreur");
    setOrders(orders.map(o => o.id === id ? { ...o, status: "archived" } : o));
  }
  async function restoreOrder(id: string) {
    const { error } = await supabase.from("orders").update({ status: "pending" }).eq("id", id);
    if (error) return toast.error("Erreur");
    setOrders(orders.map(o => o.id === id ? { ...o, status: "pending" } : o));
  }
  async function deleteOrderForever(id: string) {
    if (!confirm("Supprimer DÉFINITIVEMENT cette commande ?")) return;
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
  async function saveProduct(p: Product, patch: Partial<Product>) {
    const { error } = await supabase.from("products").update(patch).eq("id", p.id);
    if (error) return toast.error(error.message);
    setProducts(products.map(x => x.id === p.id ? { ...x, ...patch } : x));
    toast.success("Mis à jour");
  }
  async function changeProductImage(p: Product, file: File) {
    const ext = file.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("product-images").upload(path, file);
    if (upErr) return toast.error("Upload: " + upErr.message);
    const url = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
    saveProduct(p, { image_url: url });
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
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="orders">Commandes ({orders.length})</TabsTrigger>
            <TabsTrigger value="products">​Description ({products.length})</TabsTrigger>
            <TabsTrigger value="suggestions">Suggestions ({suggestions.length})</TabsTrigger>
            <TabsTrigger value="bundles">Packs ({tiers.length})</TabsTrigger>
            <TabsTrigger value="coupons">Coupons ({coupons.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-3 mt-6">
            {(() => {
              const active = orders.filter(o => o.status === "pending" || o.status === "fulfilled");
              const history = orders.filter(o => o.status === "archived");
              return (
                <Tabs defaultValue="active">
                  <TabsList>
                    <TabsTrigger value="active">Actives ({active.length})</TabsTrigger>
                    <TabsTrigger value="history">Historique ({history.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="active" className="space-y-3 mt-4">
                    {active.length === 0 && <p className="text-muted-foreground text-center py-12">Aucune commande active.</p>}
                    {active.map(o => (
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
                            <Button size="sm" variant="destructive" onClick={() => archiveOrder(o.id)}>Archiver</Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="history" className="space-y-3 mt-4">
                    {history.length === 0 && <p className="text-muted-foreground text-center py-12">Aucune commande archivée.</p>}
                    {history.map(o => (
                      <Card key={o.id} className="p-5 bg-card border-border opacity-80">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="flex-1 min-w-[200px]">
                            <div className="flex items-center gap-3 flex-wrap">
                              <h3 className="text-lg font-semibold">{o.first_name} {o.last_name}</h3>
                              <span className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground">Groupe {o.class_group}</span>
                              {o.product_name && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">{o.product_name}</span>}
                              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Archivée</span>
                            </div>
                            {o.more_details && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{o.more_details}</p>}
                            <p className="text-xs text-muted-foreground mt-2">{new Date(o.created_at).toLocaleString("fr-CA")}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => restoreOrder(o.id)}>Restaurer</Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteOrderForever(o.id)}>Suppr. définitivement</Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </TabsContent>
                </Tabs>
              );
            })()}
          </TabsContent>

          <TabsContent value="products" className="space-y-6 mt-6">
            <Card className="p-6 bg-card border-border">
              <h2 className="text-lg font-semibold mb-4">Ajouter un objet</h2>
              <form onSubmit={addProduct} className="grid sm:grid-cols-2 gap-4">
                <div><Label htmlFor="pn">Nom</Label><Input id="pn" value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} maxLength={80} required /></div>
                <div><Label htmlFor="pp">Prix ($)</Label><Input id="pp" type="number" step="0.01" min="0" value={np.price} onChange={(e) => setNp({ ...np, price: e.target.value })} required /></div>
                <div className="sm:col-span-2"><Label htmlFor="pd">Description</Label><Textarea id="pd" value={np.description} onChange={(e) => setNp({ ...np, description: e.target.value })} maxLength={300} rows={2} /></div>
                <div className="sm:col-span-2"><Label htmlFor="pi">Image</Label><Input id="pi" type="file" accept="image/*" onChange={(e) => setNpFile(e.target.files?.[0] ?? null)} /></div>
                <div className="sm:col-span-2"><Button type="submit" disabled={npBusy} style={{ background: "var(--gradient-hero)", color: "oklch(0.97 0.01 300)" }}>{npBusy ? "Ajout..." : "Ajouter"}</Button></div>
              </form>
            </Card>

            <div className="space-y-4">
              {products.map(p => {
                const eff = Number(p.price) * (1 - Number(p.discount_percent || 0) / 100);
                return (
                  <Card key={p.id} className="p-4 bg-card border-border space-y-4">
                    <div className="flex flex-wrap gap-4 items-start">
                      <div className="w-24 h-24 rounded bg-muted overflow-hidden shrink-0 relative">
                        {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-[200px] space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {!p.active && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Caché</span>}
                          {p.is_star && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300">⭐ Populaire</span>}
                          {p.coming_soon && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">Bientôt</span>}
                          {p.preorder_enabled && p.coming_soon && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">Précmd +0.50$</span>}
                          {Number(p.discount_percent) > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">−{Number(p.discount_percent)}% → {eff.toFixed(2)} $</span>}
                        </div>
                        <div>
                          <Label htmlFor={`nm-${p.id}`} className="text-xs">Nom</Label>
                          <Input id={`nm-${p.id}`} defaultValue={p.name} className="h-9"
                            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== p.name) saveProduct(p, { name: v }); }} />
                        </div>
                        <div>
                          <Label htmlFor={`de-${p.id}`} className="text-xs">Description</Label>
                          <Textarea id={`de-${p.id}`} defaultValue={p.description ?? ""} rows={2} maxLength={300}
                            onBlur={(e) => { const v = e.target.value.trim(); if (v !== (p.description ?? "")) saveProduct(p, { description: v || null as any }); }} />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <Label htmlFor={`pr-${p.id}`} className="text-xs">Prix ($)</Label>
                        <Input id={`pr-${p.id}`} type="number" step="0.01" min="0" defaultValue={Number(p.price).toFixed(2)} className="h-9 w-24"
                          onBlur={(e) => { const v = Number(e.target.value); if (!isNaN(v) && v !== Number(p.price)) saveProduct(p, { price: v }); }} />
                      </div>
                      <div>
                        <Label htmlFor={`ds-${p.id}`} className="text-xs">Rabais (%)</Label>
                        <Input id={`ds-${p.id}`} type="number" step="1" min="0" max="100" defaultValue={Number(p.discount_percent || 0)} className="h-9 w-20"
                          onBlur={(e) => { const v = Number(e.target.value); if (!isNaN(v) && v !== Number(p.discount_percent)) saveProduct(p, { discount_percent: v }); }} />
                      </div>
                      <div>
                        <Label htmlFor={`im-${p.id}`} className="text-xs">Changer image</Label>
                        <Input id={`im-${p.id}`} type="file" accept="image/*" className="h-9"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) changeProductImage(p, f); }} />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                      <Button size="sm" variant={p.is_star ? "default" : "outline"} onClick={() => saveProduct(p, { is_star: !p.is_star })}>
                        {p.is_star ? "⭐ Retirer populaire" : "⭐ Marquer populaire"}
                      </Button>
                      <Button size="sm" variant={p.coming_soon ? "default" : "outline"} onClick={() => saveProduct(p, { coming_soon: !p.coming_soon })}>
                        {p.coming_soon ? "Annuler bientôt" : "Bientôt disponible"}
                      </Button>
                      {p.coming_soon && (
                        <Button size="sm" variant={p.preorder_enabled ? "default" : "outline"} onClick={() => saveProduct(p, { preorder_enabled: !p.preorder_enabled })}>
                          {p.preorder_enabled ? "Désactiver précmd" : "Activer précmd (+0.50$)"}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => toggleActive(p)}>{p.active ? "Cacher" : "Activer"}</Button>
                      <Button size="sm" variant="destructive" onClick={() => removeProduct(p.id)}>Suppr.</Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="suggestions" className="space-y-3 mt-6">
            {suggestions.length === 0 && <p className="text-muted-foreground text-center py-12">Aucune suggestion.</p>}
            {suggestions.map(s => (
              <Card key={s.id} className="p-5 bg-card border-border">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-4 flex-1 min-w-0">
                    {s.image_url && (
                      <a href={s.image_url} target="_blank" rel="noreferrer" className="w-24 h-24 rounded bg-muted overflow-hidden shrink-0 block">
                        <img src={s.image_url} alt={s.fidget_name} className="w-full h-full object-cover" />
                      </a>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold">{s.fidget_name}</h3>
                      {s.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{s.description}</p>}
                      <p className="text-xs text-muted-foreground mt-2">
                        {s.submitter_name ? `Par ${s.submitter_name} • ` : ""}{new Date(s.created_at).toLocaleString("fr-CA")}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="destructive" onClick={() => removeSuggestion(s.id)}>Suppr.</Button>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="bundles" className="space-y-6 mt-6">
            <Card className="p-6 bg-card border-border">
              <h2 className="text-lg font-semibold mb-1">Ajouter un pack</h2>
              <p className="text-sm text-muted-foreground mb-4">Quand le client a au moins X items, le rabais s'applique au total.</p>
              <form onSubmit={addTier} className="grid sm:grid-cols-3 gap-4">
                <div><Label htmlFor="bq">Quantité min</Label><Input id="bq" type="number" min="2" step="1" value={newTier.min_qty} onChange={(e) => setNewTier({ ...newTier, min_qty: e.target.value })} required /></div>
                <div><Label htmlFor="bd">Rabais (%)</Label><Input id="bd" type="number" min="0" max="100" step="1" value={newTier.discount_percent} onChange={(e) => setNewTier({ ...newTier, discount_percent: e.target.value })} required /></div>
                <div className="flex items-end"><Button type="submit" style={{ background: "var(--gradient-hero)", color: "oklch(0.97 0.01 300)" }}>Ajouter</Button></div>
              </form>
            </Card>
            <div className="space-y-3">
              {tiers.length === 0 && <p className="text-muted-foreground text-center py-8">Aucun pack défini.</p>}
              {tiers.map(t => (
                <Card key={t.id} className="p-4 bg-card border-border flex items-center justify-between gap-4">
                  <p className="font-semibold">À partir de {t.min_qty} items → −{Number(t.discount_percent)}%</p>
                  <Button size="sm" variant="destructive" onClick={() => removeTier(t.id)}>Suppr.</Button>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="coupons" className="space-y-6 mt-6">
            <Card className="p-6 bg-card border-border">
              <h2 className="text-lg font-semibold mb-1">Créer un coupon</h2>
              <p className="text-sm text-muted-foreground mb-4">Le client entre ce code à la commande pour avoir le rabais.</p>
              <form onSubmit={addCoupon} className="grid sm:grid-cols-3 gap-4">
                <div><Label htmlFor="cc">Code</Label><Input id="cc" placeholder="Ex: NOEL10" value={newCoupon.code} onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })} required /></div>
                <div><Label htmlFor="cd">Rabais (%)</Label><Input id="cd" type="number" min="1" max="100" step="1" value={newCoupon.discount_percent} onChange={(e) => setNewCoupon({ ...newCoupon, discount_percent: e.target.value })} required /></div>
                <div className="flex items-end"><Button type="submit" style={{ background: "var(--gradient-hero)", color: "oklch(0.97 0.01 300)" }}>Créer</Button></div>
              </form>
            </Card>
            <div className="space-y-3">
              {coupons.length === 0 && <p className="text-muted-foreground text-center py-8">Aucun coupon.</p>}
              {coupons.map(c => (
                <Card key={c.id} className="p-4 bg-card border-border flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono font-semibold text-lg">{c.code}</span>
                    <span className="text-sm text-primary">−{Number(c.discount_percent)}%</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {c.active ? "Actif" : "Désactivé"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => toggleCoupon(c)}>{c.active ? "Désactiver" : "Activer"}</Button>
                    <Button size="sm" variant="destructive" onClick={() => removeCoupon(c.id)}>Suppr.</Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
