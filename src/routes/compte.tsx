import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { syntheticEmail, type Profile } from "@/lib/account";

export const Route = createFileRoute("/compte")({
  component: AccountPage,
  head: () => ({ meta: [{ title: "Mon compte — Fidgets" }] }),
});

function AccountPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [form, setForm] = useState({ first_name: "", last_name: "", class_group: "", password: "" });
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle()
      .then(({ data }) => setProfile(data as Profile | null));
  }, [session]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { first_name, last_name, class_group, password } = form;
    if (!first_name.trim() || !last_name.trim() || !class_group.trim() || password.length < 6) {
      return toast.error("Tous les champs requis (mot de passe ≥ 6).");
    }
    setBusy(true);
    const email = syntheticEmail(first_name, last_name, class_group);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) { setBusy(false); return toast.error(error.message); }
      // create profile
      if (data.user) {
        await supabase.from("profiles").insert({
          id: data.user.id, first_name: first_name.trim(), last_name: last_name.trim(), class_group: class_group.trim(),
        });
      }
      // ensure signed in
      if (!data.session) await supabase.auth.signInWithPassword({ email, password });
      toast.success("Compte créé !");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setBusy(false); return toast.error("Identifiants invalides"); }
      toast.success("Connecté");
    }
    setBusy(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    toast.success("Déconnecté");
    nav({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-center" />
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <Link to="/" className="text-sm text-muted-foreground hover:text-primary">← Retour</Link>
        <div className="flex gap-3 text-sm">
          <Link to="/commandes" className="text-muted-foreground hover:text-primary">Mes commandes</Link>
        </div>
      </header>
      <main className="container mx-auto px-6 py-12 max-w-md">
        {session && profile ? (
          <Card className="p-8 bg-card border-border space-y-4">
            <h1 className="text-2xl font-bold">Bonjour {profile.first_name} !</h1>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><span className="text-foreground">Prénom :</span> {profile.first_name}</p>
              <p><span className="text-foreground">Nom :</span> {profile.last_name}</p>
              <p><span className="text-foreground">Groupe-classe :</span> {profile.class_group}</p>
            </div>
            <p className="text-sm text-primary bg-primary/10 border border-primary/30 rounded p-3">
              ✨ Tu n'as plus besoin de retaper ton prénom, ton nom et ton groupe à chaque commande.
            </p>
            <div className="flex gap-2">
              <Link to="/commandes" className="flex-1">
                <Button variant="outline" className="w-full">Mes commandes</Button>
              </Link>
              <Button variant="destructive" onClick={logout}>Déconnexion</Button>
            </div>
          </Card>
        ) : session && !profile ? (
          // Signed in but no profile yet — let them complete it
          <Card className="p-8 bg-card border-border space-y-4">
            <h1 className="text-2xl font-bold">Compléter ton profil</h1>
            <CompleteProfileForm userId={session.user.id} onDone={(p) => setProfile(p)} />
          </Card>
        ) : (
          <Card className="p-8 bg-card border-border">
            <div className="mb-6">
              <h1 className="text-2xl font-bold mb-2">{mode === "signup" ? "Créer un compte" : "Se connecter"}</h1>
              <p className="text-sm text-primary bg-primary/10 border border-primary/30 rounded p-3">
                ✨ Crée un compte pour ne plus avoir à entrer ton prénom, ton nom et ton groupe-classe à chaque commande.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="fn">Prénom <span className="text-destructive">*</span></Label>
                <Input id="fn" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="ln">Nom de famille <span className="text-destructive">*</span></Label>
                <Input id="ln" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="cg">Groupe-classe <span className="text-destructive">*</span></Label>
                <Input id="cg" placeholder="Ex: 504" value={form.class_group} onChange={(e) => setForm({ ...form, class_group: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="pw">Mot de passe <span className="text-destructive">*</span></Label>
                <Input id="pw" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={6} required />
              </div>
              <Button type="submit" disabled={busy} className="w-full" style={{ background: "var(--gradient-hero)", color: "oklch(0.97 0.01 300)" }}>
                {busy ? "..." : (mode === "signup" ? "Créer mon compte" : "Se connecter")}
              </Button>
            </form>
            <button onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className="text-sm text-muted-foreground hover:text-primary mt-4 block mx-auto">
              {mode === "signup" ? "Déjà un compte ? Connexion" : "Pas de compte ? S'inscrire"}
            </button>
          </Card>
        )}
      </main>
    </div>
  );
}

function CompleteProfileForm({ userId, onDone }: { userId: string; onDone: (p: Profile) => void }) {
  const [f, setF] = useState({ first_name: "", last_name: "", class_group: "" });
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!f.first_name.trim() || !f.last_name.trim() || !f.class_group.trim()) return toast.error("Tous les champs requis");
        setBusy(true);
        const { error } = await supabase.from("profiles").insert({ id: userId, ...f });
        setBusy(false);
        if (error) return toast.error(error.message);
        onDone({ id: userId, ...f });
      }}
      className="space-y-3"
    >
      <Input placeholder="Prénom" value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} />
      <Input placeholder="Nom" value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} />
      <Input placeholder="Groupe-classe" value={f.class_group} onChange={(e) => setF({ ...f, class_group: e.target.value })} />
      <Button type="submit" disabled={busy} className="w-full">Enregistrer</Button>
    </form>
  );
}
