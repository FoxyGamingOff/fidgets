import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Admin — Spiral Cone" }] }),
});

type Order = {
  id: string;
  first_name: string;
  last_name: string;
  class_group: string;
  more_details: string | null;
  status: string;
  created_at: string;
};

function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setIsAdmin(false); return; }
    (async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [session]);

  useEffect(() => {
    if (!isAdmin) return;
    loadOrders();
  }, [isAdmin]);

  async function loadOrders() {
    const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (error) { toast.error("Impossible de charger"); return; }
    setOrders(data as Order[]);
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/admin" } });
      if (error) toast.error(error.message);
      else toast.success("Compte créé. Demande à un admin de t'attribuer le rôle admin.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
    }
    setBusy(false);
  }

  async function toggleStatus(id: string, current: string) {
    const next = current === "pending" ? "fulfilled" : "pending";
    const { error } = await supabase.from("orders").update({ status: next }).eq("id", id);
    if (error) { toast.error("Erreur"); return; }
    setOrders(orders.map(o => o.id === id ? { ...o, status: next } : o));
  }

  async function remove(id: string) {
    if (!confirm("Supprimer cette commande ?")) return;
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) { toast.error("Erreur"); return; }
    setOrders(orders.filter(o => o.id !== id));
  }

  if (checking) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">…</div>;

  if (!session) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <Toaster theme="dark" position="top-center" />
        <Card className="p-8 w-full max-w-md bg-card border-border">
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary">← Retour</Link>
          <h1 className="text-3xl font-bold mt-4 mb-1">Admin</h1>
          <p className="text-sm text-muted-foreground mb-6">{mode === "signin" ? "Connecte-toi pour voir les commandes." : "Crée un compte (le rôle admin doit être attribué ensuite)."}</p>
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <Label htmlFor="em">Courriel</Label>
              <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="pw">Mot de passe</Label>
              <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
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
          <p className="text-muted-foreground text-sm mb-2">
            Ton compte ({session.user.email}) n'a pas le rôle admin.
          </p>
          <p className="text-muted-foreground text-xs mb-6">
            Pour t'attribuer le rôle, exécute dans la base : <br />
            <code className="text-primary">INSERT INTO user_roles(user_id, role) VALUES ('{session.user.id}', 'admin');</code>
          </p>
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
          <h1 className="text-2xl font-bold mt-1">Commandes ({orders.length})</h1>
        </div>
        <Button onClick={() => supabase.auth.signOut()} variant="outline" size="sm">Déconnexion</Button>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-5xl space-y-3">
        {orders.length === 0 && <p className="text-muted-foreground text-center py-12">Aucune commande pour l'instant.</p>}
        {orders.map(o => (
          <Card key={o.id} className="p-5 bg-card border-border">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-lg font-semibold">{o.first_name} {o.last_name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground">Groupe {o.class_group}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${o.status === "fulfilled" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {o.status === "fulfilled" ? "Livrée" : "En attente"}
                  </span>
                </div>
                {o.more_details && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{o.more_details}</p>}
                <p className="text-xs text-muted-foreground mt-2">{new Date(o.created_at).toLocaleString("fr-CA")}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => toggleStatus(o.id, o.status)}>
                  {o.status === "pending" ? "Marquer livrée" : "Réouvrir"}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => remove(o.id)}>Suppr.</Button>
              </div>
            </div>
          </Card>
        ))}
      </main>
    </div>
  );
}
