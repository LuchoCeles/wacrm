"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare, CheckCircle, ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      setError("No se pudo enviar el correo. Verifica que la dirección sea correcta.");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  // Pantalla de éxito estilizada (igual que en registro)
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle className="h-8 w-8 text-primary" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-foreground">
            Revisa tu correo
          </h2>
          <p className="mb-8 text-muted-foreground">
            Hemos enviado un enlace de recuperación a <span className="font-medium text-foreground">{email}</span>. 
            Por favor, revisa tu bandeja de entrada para restablecer tu contraseña.
          </p>
          <Link href="/login">
            <Button className="w-full h-11" variant="outline">
              Volver a iniciar sesión
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Panel Izquierdo - Visual/Branding (Oculto en móviles) */}
      <div className="relative hidden w-1/2 flex-col justify-between border-r border-border bg-muted/30 p-12 lg:flex overflow-hidden">
        {/* Efectos de fondo sutiles */}
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
            <MessageSquare className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">
            CRM LogaByte
          </span>
        </div>

        <div className="relative z-10 mt-auto max-w-md">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-background shadow-sm border border-border">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground mb-4">
            No te preocupes.
          </h1>
          <p className="text-lg text-muted-foreground">
            Recupera el acceso a tu cuenta rápidamente y sigue gestionando las comunicaciones de tu equipo sin interrupciones.
          </p>
        </div>
      </div>

      {/* Panel Derecho - Formulario */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:max-w-md">
          
          {/* Header del Formulario */}
          <div className="mb-8">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 lg:hidden">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              Recuperar contraseña
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ingresa tu correo electrónico y te enviaremos un enlace para que puedas restablecerla.
            </p>
          </div>

          <form onSubmit={handleReset} className="space-y-6">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 bg-muted/50 focus-visible:bg-transparent"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="group h-11 w-full text-base"
            >
              {loading ? "Enviando enlace..." : "Enviar enlace de recuperación"}
              {!loading && <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />}
            </Button>
          </form>

          <div className="mt-8">
            <Link
              href="/login"
              className="group flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Volver a iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}