/**
 * Starter flow templates.
 *
 * Three pre-canned flows users can clone with one click instead of
 * building from scratch. Each template is a plain JS object describing
 * the same shape `/api/flows` PUT accepts — name, trigger config,
 * entry_node_id, fallback_policy, nodes[] — keyed by a stable
 * `slug`.
 *
 * The clone path (`/api/flows` POST with `template_slug`) creates a
 * NEW flow_row + flow_nodes rows for the user. `node_key`s are kept
 * verbatim (they're stable strings, not UUIDs, so cloning never
 * needs to rewrite edge references).
 *
 * Choosing a single static module over a DB-backed gallery for v1
 * because: (a) the set is small and changes with code releases, not
 * data; (b) keeps templates portable across self-hosted instances
 * without migrations; (c) editing in source is the lowest-friction
 * way to add the next template.
 */

import type {
  CollectInputNodeConfig,
  ConditionNodeConfig,
  HandoffNodeConfig,
  KeywordTriggerConfig,
  SendButtonsNodeConfig,
  SendListNodeConfig,
  SendMessageNodeConfig,
  StartNodeConfig,
} from './types';

export type FlowTemplateNodeType =
  | 'start'
  | 'send_message'
  | 'send_buttons'
  | 'send_list'
  | 'collect_input'
  | 'condition'
  | 'set_tag'
  | 'handoff'
  | 'end';

export interface FlowTemplateNode {
  node_key: string;
  node_type: FlowTemplateNodeType;
  config:
    | StartNodeConfig
    | SendMessageNodeConfig
    | SendButtonsNodeConfig
    | SendListNodeConfig
    | CollectInputNodeConfig
    | ConditionNodeConfig
    | HandoffNodeConfig
    | Record<string, unknown>;
}

export interface FlowTemplate {
  slug: string;
  name: string;
  description: string;
  /** Used by the gallery to surface a relevant icon. lucide-react name. */
  icon: 'MessageSquare' | 'HelpCircle' | 'UserPlus';
  trigger_type: 'keyword' | 'first_inbound_message' | 'manual';
  trigger_config: KeywordTriggerConfig | Record<string, unknown>;
  entry_node_id: string;
  nodes: FlowTemplateNode[];
}

// ============================================================
// 1. Menú de atención — punto de entrada para consultas habituales
// ============================================================
const WELCOME_MENU: FlowTemplate = {
  slug: 'welcome_menu',
  name: 'Menú de atención',
  description:
    'Da la bienvenida y orienta cada consulta hacia las preguntas frecuentes, el seguimiento de una solicitud o el equipo de atención.',
  icon: 'MessageSquare',
  trigger_type: 'keyword',
  trigger_config: {
    keywords: ['soporte', 'ayuda', 'hola'],
    match_type: 'contains',
  },
  entry_node_id: 'inicio',
  nodes: [
    {
      node_key: 'inicio',
      node_type: 'start',
      config: { next_node_key: 'bienvenida' },
    },
    {
      node_key: 'bienvenida',
      node_type: 'send_buttons',
      config: {
        text: '¡Hola! 👋 Estamos para ayudarte. Elige una opción para resolver tu consulta.',
        footer_text: 'Personaliza estos temas según tu empresa.',
        buttons: [
          {
            reply_id: 'ver_preguntas',
            title: 'Ver preguntas',
            next_node_key: 'temas_frecuentes',
          },
          {
            reply_id: 'seguir_solicitud',
            title: 'Seguir solicitud',
            next_node_key: 'pedir_referencia',
          },
          {
            reply_id: 'hablar_con_soporte',
            title: 'Hablar con soporte',
            next_node_key: 'transferencia_soporte',
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: 'temas_frecuentes',
      node_type: 'send_list',
      config: {
        text: 'Selecciona el tema sobre el que necesitas información.',
        button_label: 'Ver temas',
        sections: [
          {
            title: 'Información general',
            rows: [
              {
                reply_id: 'horarios',
                title: 'Horarios y ubicación',
                next_node_key: 'respuesta_horarios',
              },
              {
                reply_id: 'pagos',
                title: 'Pagos y comprobantes',
                next_node_key: 'respuesta_pagos',
              },
              {
                reply_id: 'cambios',
                title: 'Cambios y devoluciones',
                next_node_key: 'respuesta_cambios',
              },
            ],
          },
        ],
      } as SendListNodeConfig,
    },
    {
      node_key: 'respuesta_horarios',
      node_type: 'send_message',
      config: {
        text: 'Atendemos de lunes a viernes, de 9:00 a 18:00 (hora local). Actualiza este mensaje con los horarios y canales de tu empresa.',
        next_node_key: 'fin',
      } as SendMessageNodeConfig,
    },
    {
      node_key: 'respuesta_pagos',
      node_type: 'send_message',
      config: {
        text: 'Aquí puedes explicar los medios de pago, cómo solicitar un comprobante y dónde consultar movimientos. Personaliza esta respuesta con tu información.',
        next_node_key: 'fin',
      } as SendMessageNodeConfig,
    },
    {
      node_key: 'respuesta_cambios',
      node_type: 'send_message',
      config: {
        text: 'Indica aquí las condiciones de cambios, devoluciones o garantías de tu empresa. Si el caso requiere revisión, deriva la conversación al equipo.',
        next_node_key: 'fin',
      } as SendMessageNodeConfig,
    },
    {
      node_key: 'pedir_referencia',
      node_type: 'collect_input',
      config: {
        prompt_text:
          'Comparte el número de pedido, caso o solicitud para que podamos revisarlo.',
        var_key: 'referencia',
        next_node_key: 'transferencia_soporte',
      } as CollectInputNodeConfig,
    },
    {
      node_key: 'transferencia_soporte',
      node_type: 'handoff',
      config: {
        note: 'Consulta derivada desde el menú de atención. Revisa el historial de la conversación y la referencia proporcionada, si existe.',
      } as HandoffNodeConfig,
    },
    {
      node_key: 'fin',
      node_type: 'end',
      config: {},
    },
  ],
};

// ============================================================
// 2. Preguntas frecuentes — respuestas automatizadas por lista
// ============================================================
const FAQ_BOT: FlowTemplate = {
  slug: 'faq_bot',
  name: 'Preguntas frecuentes',
  description:
    'Responde consultas habituales sobre horarios, seguimiento, pagos y cambios; deriva al equipo los casos que necesitan una respuesta personal.',
  icon: 'HelpCircle',
  trigger_type: 'keyword',
  trigger_config: {
    keywords: ['preguntas frecuentes', 'pregunta', 'información'],
    match_type: 'contains',
  },
  entry_node_id: 'inicio',
  nodes: [
    {
      node_key: 'inicio',
      node_type: 'start',
      config: { next_node_key: 'temas' },
    },
    {
      node_key: 'temas',
      node_type: 'send_list',
      config: {
        text: '¿Sobre qué tema tienes una consulta?',
        button_label: 'Ver temas',
        sections: [
          {
            title: 'Preguntas frecuentes',
            rows: [
              {
                reply_id: 'horarios',
                title: 'Horarios de atención',
                next_node_key: 'respuesta_horarios',
              },
              {
                reply_id: 'seguimiento',
                title: 'Estado de solicitud',
                next_node_key: 'pedir_referencia',
              },
              {
                reply_id: 'pagos',
                title: 'Pagos y comprobantes',
                next_node_key: 'respuesta_pagos',
              },
              {
                reply_id: 'cambios',
                title: 'Cambios y devoluciones',
                next_node_key: 'respuesta_cambios',
              },
            ],
          },
          {
            title: 'Otros temas',
            rows: [
              {
                reply_id: 'hablar_con_una_persona',
                title: 'Hablar con una persona',
                next_node_key: 'transferencia_persona',
              },
            ],
          },
        ],
      } as SendListNodeConfig,
    },
    {
      node_key: 'respuesta_horarios',
      node_type: 'send_message',
      config: {
        text: 'Atendemos de lunes a viernes, de 9:00 a 18:00 (hora local). Personaliza este mensaje con los horarios y canales de atención de tu empresa.',
        next_node_key: 'fin',
      } as SendMessageNodeConfig,
    },
    {
      node_key: 'pedir_referencia',
      node_type: 'collect_input',
      config: {
        prompt_text:
          'Para consultar el estado de un pedido, trámite o servicio, comparte el número de referencia.',
        var_key: 'referencia',
        next_node_key: 'transferencia_persona',
      } as CollectInputNodeConfig,
    },
    {
      node_key: 'respuesta_pagos',
      node_type: 'send_message',
      config: {
        text: 'Aquí puedes indicar los medios de pago disponibles, cómo solicitar un comprobante y dónde consultar movimientos. Personaliza esta respuesta con tu información.',
        next_node_key: 'fin',
      } as SendMessageNodeConfig,
    },
    {
      node_key: 'respuesta_cambios',
      node_type: 'send_message',
      config: {
        text: 'Explica aquí las condiciones de cambios, devoluciones o garantías de tu empresa. Si el caso requiere revisión, solicita que nos comparta su referencia.',
        next_node_key: 'fin',
      } as SendMessageNodeConfig,
    },
    {
      node_key: 'transferencia_persona',
      node_type: 'handoff',
      config: {
        note: 'Consulta derivada desde preguntas frecuentes. Referencia proporcionada: {{vars.referencia}}.',
      } as HandoffNodeConfig,
    },
    {
      node_key: 'fin',
      node_type: 'end',
      config: {},
    },
  ],
};

// ============================================================
// 3. Consulta no resuelta — recopila contexto para asistencia humana
// ============================================================
const LEAD_CAPTURE: FlowTemplate = {
  slug: 'lead_capture',
  name: 'Consulta no resuelta',
  description:
    'Recopila los datos mínimos cuando una persona no encuentra la respuesta en las preguntas frecuentes y deriva el caso al equipo de atención.',
  icon: 'UserPlus',
  trigger_type: 'first_inbound_message',
  trigger_config: {},
  entry_node_id: 'inicio',
  nodes: [
    {
      node_key: 'inicio',
      node_type: 'start',
      config: { next_node_key: 'introduccion' },
    },
    {
      node_key: 'introduccion',
      node_type: 'send_message',
      config: {
        text: '¡Hola! 👋 Vamos a registrar tu consulta para que el equipo pueda ayudarte.',
        next_node_key: 'pedir_nombre',
      } as SendMessageNodeConfig,
    },
    {
      node_key: 'pedir_nombre',
      node_type: 'collect_input',
      config: {
        prompt_text: 'Para registrar tu consulta, ¿cómo te llamas?',
        var_key: 'nombre',
        next_node_key: 'pedir_consulta',
      } as CollectInputNodeConfig,
    },
    {
      node_key: 'pedir_consulta',
      node_type: 'collect_input',
      config: {
        prompt_text:
          'Gracias, {{vars.nombre}}. Cuéntanos qué necesitas o indica el número de referencia, si lo tienes.',
        var_key: 'consulta',
        next_node_key: 'transferencia',
      } as CollectInputNodeConfig,
    },
    {
      node_key: 'transferencia',
      node_type: 'handoff',
      config: {
        note: 'Consulta sin resolver: nombre={{vars.nombre}}, detalle={{vars.consulta}}. Revisar y responder desde el equipo de atención.',
      } as HandoffNodeConfig,
    },
  ],
};

// ============================================================
// Registry
// ============================================================

const TEMPLATES: Record<string, FlowTemplate> = {
  welcome_menu: WELCOME_MENU,
  faq_bot: FAQ_BOT,
  lead_capture: LEAD_CAPTURE,
};

export function getFlowTemplate(slug: string): FlowTemplate | null {
  return TEMPLATES[slug] ?? null;
}

export function listFlowTemplates(): FlowTemplate[] {
  return Object.values(TEMPLATES);
}
