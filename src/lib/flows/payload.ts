import type { FlowNodeType } from './types'

/** Runtime validation for the JSON accepted by the Flows API.
 *
 * TypeScript types disappear at the route boundary. Keeping this small
 * parser separate from activation validation lets drafts remain incomplete
 * while still rejecting values that would corrupt the stored graph (for
 * example duplicate keys, an array in `config`, or a non-existent type).
 */

export const FLOW_TRIGGER_TYPES = [
  'keyword',
  'first_inbound_message',
  'manual',
] as const

export const FLOW_NODE_TYPES = [
  'start',
  'send_buttons',
  'send_list',
  'send_message',
  'send_media',
  'collect_input',
  'condition',
  'set_tag',
  'handoff',
  'end',
] as const satisfies readonly FlowNodeType[]

type FlowTriggerType = (typeof FLOW_TRIGGER_TYPES)[number]

export interface FlowNodePayload {
  node_key: string
  node_type: FlowNodeType
  config: Record<string, unknown>
  position_x?: number
  position_y?: number
}

export interface CreateFlowPayload {
  name?: string
  description?: string | null
  trigger_type?: FlowTriggerType
  trigger_config?: Record<string, unknown>
  template_slug?: string
}

export interface UpdateFlowPayload {
  name?: string
  description?: string | null
  trigger_type?: FlowTriggerType
  trigger_config?: Record<string, unknown>
  entry_node_id?: string | null
  fallback_policy?: Record<string, unknown>
  nodes?: FlowNodePayload[]
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTriggerType(value: unknown): value is FlowTriggerType {
  return typeof value === 'string' && FLOW_TRIGGER_TYPES.includes(value as FlowTriggerType)
}

function isNodeType(value: unknown): value is FlowNodeType {
  return typeof value === 'string' && FLOW_NODE_TYPES.includes(value as FlowNodeType)
}

function isPosition(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= -2147483648 &&
    value <= 2147483647
  )
}

function parseOptionalString(
  body: Record<string, unknown>,
  key: string,
  options: { nullable?: boolean; nonEmpty?: boolean } = {},
): string | null | undefined | false {
  const value = body[key]
  if (value === undefined) return undefined
  if (value === null && options.nullable) return null
  if (typeof value !== 'string') return false
  if (options.nonEmpty && !value.trim()) return false
  return value
}

function parseOptionalRecord(
  body: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined | false {
  const value = body[key]
  if (value === undefined) return undefined
  return isRecord(value) ? value : false
}

export function parseCreateFlowPayload(body: unknown): ParseResult<CreateFlowPayload> {
  if (!isRecord(body)) return { ok: false, error: 'JSON body must be an object' }

  const name = parseOptionalString(body, 'name', { nonEmpty: true })
  const description = parseOptionalString(body, 'description', { nullable: true })
  const template_slug = parseOptionalString(body, 'template_slug', { nonEmpty: true })
  const trigger_config = parseOptionalRecord(body, 'trigger_config')
  const trigger_type = body.trigger_type

  if (name === false) return { ok: false, error: 'name must be a non-empty string' }
  if (description === false) return { ok: false, error: 'description must be a string or null' }
  if (template_slug === false) return { ok: false, error: 'template_slug must be a non-empty string' }
  if (trigger_config === false) return { ok: false, error: 'trigger_config must be an object' }
  if (trigger_type !== undefined && !isTriggerType(trigger_type)) {
    return { ok: false, error: 'trigger_type is invalid' }
  }

  return {
    ok: true,
    value: {
      ...(typeof name === 'string' ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(typeof template_slug === 'string' ? { template_slug } : {}),
      ...(trigger_config !== undefined ? { trigger_config } : {}),
      ...(trigger_type !== undefined ? { trigger_type } : {}),
    },
  }
}

function parseNodes(value: unknown): ParseResult<FlowNodePayload[]> {
  if (!Array.isArray(value)) return { ok: false, error: 'nodes must be an array' }

  const nodes: FlowNodePayload[] = []
  const seenKeys = new Set<string>()
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index]
    if (!isRecord(item)) {
      return { ok: false, error: `nodes.${index} must be an object` }
    }
    if (typeof item.node_key !== 'string' || !item.node_key.trim()) {
      return { ok: false, error: `nodes.${index}.node_key must be a non-empty string` }
    }
    if (seenKeys.has(item.node_key)) {
      return { ok: false, error: `Duplicate node_key "${item.node_key}"` }
    }
    if (!isNodeType(item.node_type)) {
      return { ok: false, error: `nodes.${index}.node_type is invalid` }
    }
    if (!isRecord(item.config)) {
      return { ok: false, error: `nodes.${index}.config must be an object` }
    }
    if (item.position_x !== undefined && !isPosition(item.position_x)) {
      return { ok: false, error: `nodes.${index}.position_x must be an integer` }
    }
    if (item.position_y !== undefined && !isPosition(item.position_y)) {
      return { ok: false, error: `nodes.${index}.position_y must be an integer` }
    }

    seenKeys.add(item.node_key)
    nodes.push({
      node_key: item.node_key,
      node_type: item.node_type,
      config: item.config,
      ...(item.position_x !== undefined ? { position_x: item.position_x } : {}),
      ...(item.position_y !== undefined ? { position_y: item.position_y } : {}),
    })
  }
  return { ok: true, value: nodes }
}

export function parseUpdateFlowPayload(body: unknown): ParseResult<UpdateFlowPayload> {
  if (!isRecord(body)) return { ok: false, error: 'JSON body must be an object' }

  const name = parseOptionalString(body, 'name', { nonEmpty: true })
  const description = parseOptionalString(body, 'description', { nullable: true })
  const entry_node_id = parseOptionalString(body, 'entry_node_id', { nullable: true })
  const trigger_config = parseOptionalRecord(body, 'trigger_config')
  const fallback_policy = parseOptionalRecord(body, 'fallback_policy')
  const trigger_type = body.trigger_type

  if (name === false) return { ok: false, error: 'name must be a non-empty string' }
  if (description === false) return { ok: false, error: 'description must be a string or null' }
  if (entry_node_id === false) return { ok: false, error: 'entry_node_id must be a string or null' }
  if (trigger_config === false) return { ok: false, error: 'trigger_config must be an object' }
  if (fallback_policy === false) return { ok: false, error: 'fallback_policy must be an object' }
  if (trigger_type !== undefined && !isTriggerType(trigger_type)) {
    return { ok: false, error: 'trigger_type is invalid' }
  }

  let nodes: FlowNodePayload[] | undefined
  if (body.nodes !== undefined) {
    const parsedNodes = parseNodes(body.nodes)
    if (!parsedNodes.ok) return parsedNodes
    nodes = parsedNodes.value
  }

  return {
    ok: true,
    value: {
      ...(typeof name === 'string' ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(entry_node_id !== undefined ? { entry_node_id } : {}),
      ...(trigger_config !== undefined ? { trigger_config } : {}),
      ...(fallback_policy !== undefined ? { fallback_policy } : {}),
      ...(trigger_type !== undefined ? { trigger_type } : {}),
      ...(nodes !== undefined ? { nodes } : {}),
    },
  }
}
