'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getSiteUrl } from '@/lib/site-url';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  MessageSquare,
  CheckCircle,
  UsersRound,
  ArrowRight,
} from 'lucide-react';

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);

    const siteUrl = getSiteUrl();
    const emailRedirectTo = inviteToken
      ? `${siteUrl}/join/${encodeURIComponent(inviteToken)}`
      : `${siteUrl}/auth/callback`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo,
      },
    });

    if (error) {
      setError('No se pudo crear la cuenta. Intentá nuevamente.');
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  // Pantalla de éxito estilizada
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
            Hemos enviado un enlace de confirmación a{' '}
            <span className="text-foreground font-medium">{email}</span>. Por
            favor, revisa tu bandeja de entrada y haz clic en el enlace para
            verificar tu cuenta.
          </p>
          <Link
            href={
              inviteToken
                ? `/login?invite=${encodeURIComponent(inviteToken)}`
                : '/login'
            }
          >
            <Button className="h-11 w-full" variant="outline">
              Volver a iniciar sesión
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-screen w-full flex-row-reverse">
      {/* Panel Izquierdo (Acá a la derecha) - Visual/Branding (Oculto en móviles) */}
      <div className="border-border bg-muted/20 relative hidden w-1/2 flex-col justify-between overflow-hidden border-l p-12 lg:flex">
        <div className="bg-primary/10 absolute top-20 right-20 h-64 w-64 rounded-full blur-3xl" />

        <div className="relative z-10 flex items-center justify-end gap-3">
          <span className="text-foreground text-xl font-bold tracking-tight">
            CRM LogaByte
          </span>
          <div className="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-xl shadow-lg">
            <MessageSquare className="h-5 w-5" />
          </div>
        </div>

        <div className="relative z-10 mt-auto ml-auto max-w-md text-right">
          <h2 className="text-foreground mb-4 text-3xl font-semibold tracking-tight">
            Comienza en segundos.
          </h2>
          <p className="text-muted-foreground text-lg">
            Únete a cientos de equipos que ya están optimizando sus ventas y
            soporte al cliente mediante WhatsApp.
          </p>
        </div>
      </div>

      {/* Panel Izquierdo - Formulario */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:max-w-md">
          <div className="mb-8">
            <div className="bg-primary/10 mb-6 flex h-12 w-12 items-center justify-center rounded-2xl lg:hidden">
              <MessageSquare className="text-primary h-6 w-6" />
            </div>

            <h2 className="text-foreground flex items-center gap-2 text-3xl font-bold tracking-tight">
              {inviteToken ? (
                <>
                  <UsersRound className="text-primary h-7 w-7" />
                  Únete a tu equipo
                </>
              ) : (
                'Crear una cuenta'
              )}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              {inviteToken
                ? 'Regístrate para aceptar la invitación y colaborar.'
                : 'Ingresa tus datos para empezar a usar CRM Template.'}
            </p>
          </div>

          <form onSubmit={handleSignup} className="space-y-5">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nombre completo</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Ej. Juan Pérez"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="bg-muted/50 h-11 focus-visible:bg-transparent"
                />
              </div>

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

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mín. 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-muted/50 h-11 focus-visible:bg-transparent"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Repetir contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="bg-muted/50 h-11 focus-visible:bg-transparent"
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="group mt-2 h-11 w-full text-base"
            >
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
              {!loading && (
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              )}
            </Button>
          </form>

          <div className="mt-8 text-center text-sm">
            <span className="text-muted-foreground">
              ¿Ya tienes una cuenta?{' '}
            </span>
            <Link
              href={
                inviteToken
                  ? `/login?invite=${encodeURIComponent(inviteToken)}`
                  : '/login'
              }
              className="text-primary font-medium hover:underline"
            >
              Inicia sesión aquí
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
