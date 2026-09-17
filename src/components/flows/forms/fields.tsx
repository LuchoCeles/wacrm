'use client';

/**
 * Reusable field components shared across every per-node form.
 *
 * `NodeKeySelect` — picks a node from the flow's node list, rendered
 * with the source node's icon so the dropdown reads as
 * "destination = ◇ menu" rather than an opaque slug.
 *
 * `NextNodeRow` — wraps NodeKeySelect with a label; the most common
 * per-node form row ("after this node, advance to…").
 *
 * `TextRow` — wraps Input or Textarea behind a label. Pure UI sugar
 * to keep per-node forms uncluttered.
 *
 * Lives in src/components/flows/forms/ so both the list view's
 * collapsed-card editor and the canvas view's side-panel editor
 * (introduced in this PR) mount the exact same form components.
 */

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { nodeDisplayName, NODE_META, type BuilderNode } from '../shared';

export function TextRow({
  label,
  value,
  onChange,
  rows = 1,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div className="min-w-0">
      <label className="text-muted-foreground mb-1 block text-xs">
        {label}
      </label>
      {rows > 1 ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          wrap="soft"
          className="bg-muted max-h-[min(50vh,20rem)] min-h-[5rem] max-w-full min-w-0 resize-y overflow-x-hidden leading-6 break-words"
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-muted"
        />
      )}
    </div>
  );
}

export function NextNodeRow({
  value,
  allNodes,
  currentKey,
  onChange,
  label,
}: {
  value: string;
  allNodes: BuilderNode[];
  currentKey: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const t = useTranslations('Flows.builder.form');
  return (
    <div>
      <label className="text-muted-foreground mb-1 block text-xs">
        {label}
      </label>
      <div className="flex min-w-0 items-center gap-1.5">
        <NodeKeySelect
          value={value || null}
          nodes={allNodes}
          excludeKey={currentKey}
          onChange={(v) => onChange(v ?? '')}
          placeholder={t('pickNextNode')}
          className="flex-1"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onChange('')}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label={t('clearNextNode')}
            title={t('clearNextNode')}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Human-facing node name. Unlike node_key this can be changed freely: the
 * runner never reads it and every destination picker renders it immediately.
 */
export function NodeNameField({
  node,
  onChange,
  autoFocus = false,
}: {
  node: BuilderNode;
  onChange: (value: string) => void;
  /** Focus this when a node has just been created in the canvas. */
  autoFocus?: boolean;
}) {
  const t = useTranslations('Flows.builder');
  const value =
    typeof node.config.node_name === 'string' ? node.config.node_name : '';

  return (
    <div className="min-w-0">
      <label className="text-muted-foreground mb-1 block text-xs">
        {t('nodeNameLabel')}
      </label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('nodeNamePlaceholder')}
        maxLength={100}
        autoFocus={autoFocus}
        className="bg-muted"
      />
      <p className="text-muted-foreground mt-1 text-[11px]">
        {t('nodeNameHint')}
      </p>
    </div>
  );
}

/** A node's recognizable icon and friendly name, used inside selects and inspector headers. */
export function NodeSelectLabel({
  node,
  className,
}: {
  node: BuilderNode;
  className?: string;
}) {
  const Icon = NODE_META[node.node_type].icon;
  const t = useTranslations('Flows.builder');
  const name = nodeDisplayName(node, t(`nodes.${node.node_type}.label`));
  return (
    <span
      className={cn('inline-flex min-w-0 items-center gap-1.5', className)}
      title={name}
    >
      <Icon
        className={cn('h-3 w-3 shrink-0', NODE_META[node.node_type].color)}
      />
      <span className="truncate">{name}</span>
    </span>
  );
}

export function NodeKeySelect({
  value,
  nodes,
  excludeKey,
  onChange,
  placeholder,
  className,
}: {
  value: string | null;
  nodes: BuilderNode[];
  excludeKey?: string;
  onChange: (v: string | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const options = nodes.filter((n) => n.node_key !== excludeKey);
  const emptyLabel = placeholder ?? '—';
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn('bg-muted w-full min-w-0', className)}>
        <SelectValue placeholder={emptyLabel}>
          {(selectedValue) => {
            const selectedNode = options.find(
              (node) => node.node_key === selectedValue
            );
            return selectedNode ? (
              <NodeSelectLabel node={selectedNode} />
            ) : (
              emptyLabel
            );
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        alignItemWithTrigger={false}
        className="w-fit max-w-(--available-width) min-w-(--anchor-width)"
      >
        {options.map((node) => (
          <SelectItem key={node.node_key} value={node.node_key}>
            <NodeSelectLabel node={node} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
