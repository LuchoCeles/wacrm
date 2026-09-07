# wacrm — Plantilla de CRM para WhatsApp

> Plantilla de CRM autoalojable para WhatsApp® — bandeja de entrada
> compartida, contactos, pipelines de ventas, difusiones y
> automatizaciones sin código. Clónala, personalízala y hospédala tú
> mismo.

## Qué incluye

- **Bandeja de entrada compartida** sobre la API oficial de WhatsApp
  Business — varios agentes trabajando con un mismo número, asignación
  por conversación, estados y notas.
- **Contactos + etiquetas + campos personalizados**, importación CSV,
  deduplicación.
- **Pipelines de ventas** (Kanban) con negociaciones vinculadas a las
  conversaciones.
- **Difusiones** con plantillas aprobadas por Meta, seguimiento de
  entrega y lectura, sustitución de variables por destinatario.
- **Automatizaciones sin código** — disparadores por mensajes
  entrantes, nuevos contactos, palabras clave o programación; ramas
  condicionales, esperas, etiquetas, webhooks. Constructor visual.
- **Asistente de respuestas con IA** — usa tu propia clave de OpenAI o
  Anthropic (guardada cifrada; sin costo por asiento, tus datos son
  tuyos). Respuestas redactadas por IA con un clic en la bandeja de
  entrada, además de un bot de respuesta automática opcional con
  límite por conversación y traspaso limpio a un humano. Se puede
  añadir una **base de conocimiento** (preguntas frecuentes,
  políticas, documentación de producto) para que responda con tu
  propio contenido — búsqueda híbrida (texto completo en Postgres, o
  semántica con pgvector si se configura una clave de embeddings).
- **Panel en tiempo real** — tiempos de respuesta, volumen diario,
  valor del pipeline, feed de actividad entre módulos.
- **Cuentas de equipo** — invitación por enlace, acceso por roles
  (propietario / administrador / agente / observador), transferencia
  de propiedad. Cada instalación está asociada a una cuenta, así que
  una sola bandeja compartida puede ser atendida por todo un equipo.
  El uso individual funciona como usuario único sin configuración
  adicional.
- **Gestión de cuenta** — correo, contraseña, avatar, cierre de sesión
  global.
- **API REST pública** (`/api/v1`) con claves de API con alcance
  limitado y revocables — para construir tus propias automatizaciones
  sobre tu CRM.
- **Servidor MCP** — controla tu CRM desde asistentes de IA mediante
  el Protocolo de Contexto de Modelo. De solo lectura por defecto,
  con escritura opcional.

## Por qué usar esta plantilla

Esto es una **plantilla**, no un producto cerrado. Al usarla obtienes:

- **Propiedad total** — tu código, tu proyecto de Supabase, tu
  dominio, tus datos. Sin dependencia de un SaaS, sin precio por
  asiento.
- **Personalización total** — agrega los campos que necesite tu
  equipo, quita los módulos que no uses, rediseña lo que quieras. El
  stack es deliberadamente sencillo (Next.js + Supabase + Tailwind)
  para que la curva de aprendizaje sea corta.
- **Primitivas de seguridad reales** — cifrado de tokens
  (AES-256-GCM), RLS en cada tabla, webhooks verificados por HMAC,
  CSP, limitación de tasa.

## Inicio rápido

```bash
git clone https://github.com/<tu-usuario>/wacrm.git
cd wacrm
npm install
cp .env.local.example .env.local   # completa las credenciales de Supabase y Meta
npm run dev
```

Abre <http://localhost:3000>. Serás redirigido a `/login` (o a
`/dashboard` si ya iniciaste sesión).

### ¿Prefieres contenedores?

Este proyecto también incluye configuración de Docker y Docker
Compose para quienes prefieran desplegar con contenedores.

## Stack técnico

- **Aplicación** — Next.js 16 (App Router), React 19, TypeScript,
  Tailwind v4.
- **Datos** — Supabase (Postgres + Auth + Storage + RLS).
- **WhatsApp** — API oficial de WhatsApp Business (Meta Cloud API).

## Licencia

MIT. Clónala, personalízala y hospédala tú mismo.
