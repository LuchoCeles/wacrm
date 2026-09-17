'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getSiteUrl } from '@/lib/site-url';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  MessageSquare,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getSiteUrl()}/auth/callback?next=/reset-password`,
    });

    if (error) {
      setError(
        'No se pudo enviar el correo. Verifica que la dirección sea correcta.'
      );
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  // Pantalla de éxito estilizada (igual que en registro)
  if (success) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center px-4">
        <div className="border-border bg-card w-full max-w-md rounded-2xl border p-8 text-center shadow-sm">
          <div className="bg-primary/10 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full">
            <CheckCircle className="text-primary h-8 w-8" />
          </div>
          <h2 className="text-foreground mb-2 text-2xl font-bold">
            Revisa tu correo
          </h2>
          <p className="text-muted-foreground mb-8">
            Hemos enviado un enlace de recuperación a{' '}
            <span className="text-foreground font-medium">{email}</span>. Por
            favor, revisa tu bandeja de entrada para restablecer tu contraseña.
          </p>
          <Link href="/login">
            <Button className="h-11 w-full" variant="outline">
              Volver a iniciar sesión
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-screen w-full">
      {/* Panel Izquierdo - Visual/Branding (Oculto en móviles) */}
      <div className="border-border bg-muted/30 relative hidden w-1/2 flex-col justify-between overflow-hidden border-r p-12 lg:flex">
        {/* Efectos de fondo sutiles */}
        <div className="bg-primary/10 absolute -top-20 -left-20 h-72 w-72 rounded-full blur-3xl" />
        <div className="bg-primary/5 absolute right-0 bottom-0 h-96 w-96 rounded-full blur-3xl" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-xl shadow-lg">
            <MessageSquare className="h-5 w-5" />
          </div>
          <span className="text-foreground text-xl font-bold tracking-tight">
            CRM LogaByte
          </span>
        </div>

        <div className="relative z-10 mt-auto max-w-md">
          <div className="bg-background border-border mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border shadow-sm">
            <ShieldCheck className="text-primary h-6 w-6" />
          </div>
          <h1 className="text-foreground mb-4 text-4xl font-semibold tracking-tight">
            No te preocupes.
          </h1>
          <p className="text-muted-foreground text-lg">
            Recupera el acceso a tu cuenta rápidamente y sigue gestionando las
            comunicaciones de tu equipo sin interrupciones.
          </p>
        </div>
      </div>

      {/* Panel Derecho - Formulario */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:max-w-md">
          {/* Header del Formulario */}
          <div className="mb-8">
            <div className="bg-primary/10 mb-6 flex h-12 w-12 items-center justify-center rounded-2xl lg:hidden">
              <MessageSquare className="text-primary h-6 w-6" />
            </div>

            <h2 className="text-foreground text-3xl font-bold tracking-tight">
              Recuperar contraseña
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Ingresa tu correo electrónico y te enviaremos un enlace para que
              puedas restablecerla.
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
                className="bg-muted/50 h-11 focus-visible:bg-transparent"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="group h-11 w-full text-base"
            >
              {loading ? 'Enviando enlace...' : 'Enviar enlace de recuperación'}
              {!loading && (
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              )}
            </Button>
          </form>

          <div className="mt-8">
            <Link
              href="/login"
              className="group text-muted-foreground hover:text-foreground flex items-center justify-center gap-2 text-sm font-medium transition-colors"
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
