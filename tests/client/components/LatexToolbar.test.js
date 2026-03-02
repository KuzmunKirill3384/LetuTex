import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LatexToolbar from '../../../src/components/LatexToolbar.vue';

describe('LatexToolbar', () => {
  it('renders toolbar buttons', () => {
    const wrapper = mount(LatexToolbar);
    const buttons = wrapper.findAll('button');
    expect(buttons.length).toBeGreaterThan(5);
  });

  it('emits insert event on button click', async () => {
    const wrapper = mount(LatexToolbar);
    const buttons = wrapper.findAll('button');
    const firstSnippetButton = buttons[0];
    await firstSnippetButton.trigger('click');
    expect(wrapper.emitted('insert') || wrapper.emitted('add-snippet')).toBeTruthy();
  });

  it('renders custom snippets when provided', () => {
    const wrapper = mount(LatexToolbar, {
      props: {
        customSnippets: [{ label: 'eq', title: 'Equation', snippet: '\\begin{equation}' }],
      },
    });
    const text = wrapper.text();
    expect(text).toContain('eq');
  });

  it('emits add-snippet on + button click', async () => {
    const wrapper = mount(LatexToolbar);
    const plusBtn = wrapper.findAll('button').find((b) => {
      const svg = b.find('svg');
      return svg.exists() && b.attributes('data-tip') === 'Добавить свой сниппет';
    });
    expect(plusBtn).toBeDefined();
    if (plusBtn) {
      await plusBtn.trigger('click');
      expect(wrapper.emitted('add-snippet')).toBeTruthy();
    }
  });
});
