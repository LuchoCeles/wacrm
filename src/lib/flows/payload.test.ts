import { describe, expect, it } from 'vitest'

import {
  parseCreateFlowPayload,
  parseUpdateFlowPayload,
} from './payload'

describe('flow API payload parsing', () => {
  it('accepts incomplete but structurally valid draft nodes', () => {
    const result = parseUpdateFlowPayload({
      name: 'Draft',
      nodes: [
        {
          node_key: 'start',
          node_type: 'start',
          config: { next_node_key: '' },
          position_x: 12,
          position_y: -8,
        },
      ],
    })

    expect(result).toMatchObject({ ok: true })
  })

  it('rejects invalid route-boundary values before they reach JSONB', () => {
    expect(parseCreateFlowPayload({ name: 42 }).ok).toBe(false)
    expect(
      parseUpdateFlowPayload({
        nodes: [{ node_key: 'one', node_type: 'end', config: [] }],
      }).ok,
    ).toBe(false)
    expect(
      parseUpdateFlowPayload({
        nodes: [
          { node_key: 'same', node_type: 'end', config: {} },
          { node_key: 'same', node_type: 'end', config: {} },
        ],
      }).ok,
    ).toBe(false)
  })

  it('rejects unsupported node and trigger types', () => {
    expect(parseCreateFlowPayload({ trigger_type: 'webhook' }).ok).toBe(false)
    expect(
      parseUpdateFlowPayload({
        nodes: [{ node_key: 'x', node_type: 'http_fetch', config: {} }],
      }).ok,
    ).toBe(false)
  })
})
