import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/commandes")({
  component: OrdersPage,
  head: () => ({ meta: [{ title: "Mes commandes — Fidgets" }] }),
});

type Order = {
  id: string;
  product_name: string | null;
  more_details: string | null;
  delivery_note: string | null;
  status: string;
  created_at: string;
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "En attente", cls: "bg-muted text-muted-foreground" },
  in_delivery: { label: "En livraison", cls: "bg-blue-500/20 text-blue-300" },
  fulfilled: { label: "Livrée", cls: "bg-primary/20 text-primary" },
  delivered: { label: "Livrée", cls: "bg-primary/20 text-primary" },
  archived: { label: "Archivée", cls: "bg-muted text-muted-foreground" },
};

function OrdersPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    supabase.from("orders").select("id,product_name,more_details,delivery_note,status,created_at")
      .eq("user_id", session.user.id).order("created_at", { ascending: false })
      .then(({ data }) => { setOrders((data as Order[]) ?? []); setLoading(false); });
  }, [session]);

  if (!session) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
        <Toaster theme="dark" position="top-center" />
        <Card className="p-8 max-w-md text-center bg-card border-border">
          <h1 className="text-2xl font-bold mb-2">Connecte-toi pour voir tes commandes</h1>
          <p className="text-sm text-muted-foreground mb-6">Tu dois avoir un compte pour suivre tes commandes.</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => nav({ to: "/compte" })}>Mon compte</Button>
            <Link to="/"><Button variant="outline">← Site</Button></Link>
          </div>
        </Card>
      </div>
    );
  }

  const active = orders.filter((o) => o.status === "pending" || o.status === "in_delivery");
  const history = orders.filter((o) => o.status === "fulfilled" || o.status === "delivered" || o.status === "archived");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-center" />
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <Link to="/" className="text-sm text-muted-foreground hover:text-primary">← Retour</Link>
        <Link to="/compte" className="text-sm text-muted-foreground hover:text-primary">Mon compte</Link>
      </header>
      <main className="container mx-auto px-6 py-12 max-w-3xl space-y-10">
        <h1 className="text-3xl font-bold">Mes commandes</h1>
        {loading && <p className="text-muted-foreground">…</p>}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">En cours ({active.length})</h2>
          {active.length === 0 && <p className="text-sm text-muted-foreground">Aucune commande en cours.</p>}
          {active.map((o) => <OrderCard key={o.id} o={o} />)}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Historique ({history.length})</h2>
          {history.length === 0 && <p className="text-sm text-muted-foreground">Aucune commande livrée pour l'instant.</p>}
          {history.map((o) => <OrderCard key={o.id} o={o} />)}
        </section>
      </main>
    </div>
  );
}

function OrderCard({ o }: { o: Order }) {
  const st = STATUS_LABEL[o.status] ?? STATUS_LABEL.pending;
  return (
    <Card className="p-5 bg-card border-border">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
            {o.product_name && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">{o.product_name}</span>}
          </div>
          {o.more_details && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{o.more_details}</p>}
          {o.delivery_note && (
            <div className="mt-3 p-3 rounded bg-blue-500/10 border border-blue-500/30 text-sm">
              <p className="font-semibold text-blue-300 mb-1">📦 Note de livraison</p>
              <p className="text-foreground/90 whitespace-pre-wrap">{o.delivery_note}</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">{new Date(o.created_at).toLocaleString("fr-CA")}</p>
        </div>
      </div>
    </Card>
  );
}
