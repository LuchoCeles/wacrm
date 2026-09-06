"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare, UsersRound, ArrowRight } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Credenciales incorrectas o ha ocurrido un error.");
      setLoading(false);
      return;
    }

    const destination = inviteToken
      ? `/join/${encodeURIComponent(inviteToken)}`
      : "/dashboard";
    window.location.href = destination;
  };

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
          <h1 className="text-4xl font-semibold tracking-tight text-foreground mb-4">
            Gestión de WhatsApp simplificada.
          </h1>
          <p className="text-lg text-muted-foreground">
            Centraliza la comunicación de tu equipo, atiende a tus clientes más rápido y mejora tus conversiones desde un solo lugar.
          </p>
        </div>
      </div>

      {/* Panel Derecho - Formulario */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:max-w-md">
          
          {/* Header del Formulario */}
          <div className="mb-8">
            {/* Logo visible solo en móvil */}
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 lg:hidden">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            
            <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              {inviteToken ? (
                <>
                  <UsersRound className="h-7 w-7 text-primary" />
                  Aceptar invitación
                </>
              ) : (
                "Bienvenido de nuevo"
              )}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {inviteToken
                ? "Inicia sesión para unirte a tu equipo de trabajo."
                : "Ingresa tus credenciales para acceder a tu panel de control."}
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">
                {error}
              </div>
            )}

            <div className="space-y-4">
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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Contraseña</Label>
                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium text-primary hover:underline hover:text-primary/80"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 bg-muted/50 focus-visible:bg-transparent"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="group h-11 w-full text-base"
            >
              {loading ? "Iniciando sesión..." : "Iniciar sesión"}
              {!loading && <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />}
            </Button>
          </form>

          <div className="mt-8 text-center text-sm">
            <span className="text-muted-foreground">¿No tienes una cuenta? </span>
            <Link
              href={
                inviteToken
                  ? `/signup?invite=${encodeURIComponent(inviteToken)}`
                  : "/signup"
              }
              className="font-medium text-primary hover:underline"
            >
              Regístrate aquí
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}