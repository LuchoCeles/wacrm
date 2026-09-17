import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { parseUpdateFlowPayload, type FlowNodePayload } from '@/lib/flows/payload'

/**
 * Replaces a graph through the transactional RPC introduced by migration 042.
 *
 * Local and self-hosted installations can run a newer application image before
 * they apply its database migrations. In that small window PostgREST returns
 * PGRST202 because `replace_flow_definition` is absent from its schema cache.
 * The service client can safely use the pre-042 write path as a compatibility
 * fallback; every other error is returned intact and never risks a non-atomic
 * replacement.
 */
async function replaceFlowDefinition(
  admin: ReturnType<typeof supabaseAdmin>,
  flowId: string,
  flowPatch: Record<string, unknown>,
  nodes: FlowNodePayload[],
) {
  const { error: rpcError } = await admin.rpc('replace_flow_definition', {
    p_flow_id: flowId,
    p_flow_patch: flowPatch,
    p_nodes: nodes,
  })
  if (!rpcError) return null

  // PGRST202 is PostgREST's explicit "function is not in the schema cache"
  // response. Do not fall back for constraint or database errors: the RPC is
  // present in those cases and preserves the last complete graph atomically.
  if (rpcError.code !== 'PGRST202') return rpcError

  console.warn(
    '[flows] replace_flow_definition is unavailable; using the compatibility write path. Apply migration 042 to restore atomic saves.',
  )

  const { error: updateError } = await admin
    .from('flows')
    .update({ ...flowPatch, updated_at: new Date().toISOString() })
    .eq('id', flowId)
  if (updateError) return updateError

  const { error: deleteError } = await admin
    .from('flow_nodes')
    .delete()
    .eq('flow_id', flowId)
  if (deleteError) return deleteError

  if (nodes.length === 0) return null

  const { error: insertError } = await admin.from('flow_nodes').insert(
    nodes.map((node) => ({
      flow_id: flowId,
      node_key: node.node_key,
      node_type: node.node_type,
      config: node.config,
      position_x: node.position_x ?? 0,
      position_y: node.position_y ?? 0,
    })),
  )
  return insertError
}

/**
 * GET   /api/flows/[id]  — fetch one flow with its nodes.
 * PUT   /api/flows/[id]  — replace name/trigger/entry/fallback + the
 *                          full node graph atomically.
 * DELETE /api/flows/[id] — hard delete (CASCADE cleans up nodes,
 *                          runs, events).
 *
 * All three require a signed-in caller who owns the flow. Flows is in
 * soft-GA — the beta gate that previously 404'd non-beta accounts is
 * gone; the "Beta" label in the UI is the only remaining signal.
 */

async function requireOwnership(
  flowId: string,
): Promise<
  | {
      ok: true
      userId: string
      supabase: Awaited<ReturnType<typeof createClient>>
    }
  | { ok: false; status: number; body: { error: string } }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, status: 401, body: { error: 'Unauthorized' } }
  }
  // RLS scopes this to the caller — a flow owned by another user
  // returns null (404 below).
  const { data: flow, error } = await supabase
    .from('flows')
    .select('id')
    .eq('id', flowId)
    .maybeSingle()
  if (error) {
    console.error('[flows] ownership check failed:', error.message)
    return { ok: false, status: 500, body: { error: 'Could not load flow' } }
  }
  if (!flow) {
    return { ok: false, status: 404, body: { error: 'Not found' } }
  }
  return { ok: true, userId: user.id, supabase }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const guard = await requireOwnership(id)
  if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status })
  const { supabase } = guard

  const [{ data: flow, error: flowErr }, { data: nodes, error: nodesErr }] = await Promise.all([
    supabase.from('flows').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('flow_nodes')
      .select('*')
      .eq('flow_id', id)
      .order('created_at', { ascending: true }),
  ])
  if (flowErr || nodesErr) {
    return NextResponse.json(
      { error: flowErr?.message ?? nodesErr?.message ?? 'Could not load flow' },
      { status: 500 },
    )
  }
  if (!flow) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ flow, nodes: nodes ?? [] })
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params

  // Browser-side flow writes are blocked. This route mutates through the
  // service client, so it must enforce the minimum `agent` role itself
  // (a viewer still passes the membership-only ownership check).
  try {
    await requireRole('agent')
  } catch (err) {
    return toErrorResponse(err)
  }

  const guard = await requireOwnership(id)
  if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status })

  const json = await request.json().catch(() => null)
  const parsed = parseUpdateFlowPayload(json)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const body = parsed.value

  const admin = supabaseAdmin()

  // The body may not include `nodes` (a header-only save for editing
  // the trigger config without touching the graph).
  const flowPatch: Record<string, unknown> = {}
  if (body.name !== undefined) flowPatch.name = body.name.trim()
  if (body.description !== undefined)
    flowPatch.description = body.description
  if (body.trigger_type !== undefined) flowPatch.trigger_type = body.trigger_type
  if (body.trigger_config !== undefined)
    flowPatch.trigger_config = body.trigger_config
  if (body.entry_node_id !== undefined)
    flowPatch.entry_node_id = body.entry_node_id
  if (body.fallback_policy !== undefined)
    flowPatch.fallback_policy = body.fallback_policy

  if (body.nodes !== undefined) {
    // The RPC wraps the flow update and graph replacement in one database
    // transaction. A duplicate key / constraint failure therefore leaves
    // the last good definition intact instead of deleting every node.
    const error = await replaceFlowDefinition(admin, id, flowPatch, body.nodes)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error: updErr } = await admin
      .from('flows')
      .update({ ...flowPatch, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }
  }

  // Re-fetch and return the new state — the editor uses the response
  // to reconcile its local form state.
  const [{ data: flow, error: flowErr }, { data: nodes, error: nodesErr }] = await Promise.all([
    admin.from('flows').select('*').eq('id', id).maybeSingle(),
    admin
      .from('flow_nodes')
      .select('*')
      .eq('flow_id', id)
      .order('created_at', { ascending: true }),
  ])
  if (flowErr || nodesErr) {
    return NextResponse.json(
      { error: flowErr?.message ?? nodesErr?.message ?? 'Could not load saved flow' },
      { status: 500 },
    )
  }
  return NextResponse.json({ flow, nodes: nodes ?? [] })
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params

  // Browser-side flow writes are blocked; see the PUT handler note for
  // why this service-client mutation must require an `agent` role.
  try {
    await requireRole('agent')
  } catch (err) {
    return toErrorResponse(err)
  }

  const guard = await requireOwnership(id)
  if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status })

  // CASCADE on flow_nodes / flow_runs / flow_run_events handles the
  // children. Active runs end abruptly — there's no graceful "drain"
  // mechanism in v1, but that's intentional: deleting a flow is a
  // deliberate destructive action and the partial unique index will
  // free up the contact for new triggers immediately.
  const { error } = await supabaseAdmin().from('flows').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

