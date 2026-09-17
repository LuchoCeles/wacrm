import { describe, expect, it } from 'vitest';

import { listFlowTemplates } from './templates';
import { validateFlowForActivation } from './validate';

describe('starter flow templates', () => {
  it('are valid customer-assistance flows', () => {
    for (const template of listFlowTemplates()) {
      const issues = validateFlowForActivation(
        {
          name: template.name,
          trigger_type: template.trigger_type,
          trigger_config: template.trigger_config as Record<string, unknown>,
          entry_node_id: template.entry_node_id,
        },
        template.nodes.map((node) => ({
          ...node,
          config: node.config as Record<string, unknown>,
        }))
      );

      expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    }
  });

  it('does not include sales-oriented template copy', () => {
    const copy = listFlowTemplates()
      .map(
        (template) =>
          `${template.name} ${template.description} ${JSON.stringify(template.nodes)}`
      )
      .join(' ')
      .toLowerCase();

    expect(copy).not.toMatch(/prospect|ventas|precio/);
  });
});
