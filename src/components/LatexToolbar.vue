<script setup>
defineProps({
  customSnippets: { type: Array, default: () => [] },
});
const emit = defineEmits(['insert', 'add-snippet']);

const groups = [
  {
    items: [
      { label: 'B', title: 'Жирный', snippet: '\\textbf{', suffix: '}', cls: 'font-bold' },
      { label: 'I', title: 'Курсив', snippet: '\\textit{', suffix: '}', cls: 'italic' },
      { label: 'TT', title: 'Моноширинный', snippet: '\\texttt{', suffix: '}', cls: 'font-mono text-[10px]' },
      { label: '""', title: 'Кавычки', snippet: '\\enquote{', suffix: '}' },
    ],
  },
  {
    items: [
      { icon: 'M3 4h6M3 8h12M3 12h9', title: 'Секция', snippet: '\\section{}\n', offset: -2 },
      { icon: 'M3 4h4M3 8h10M3 12h7', title: 'Подсекция', snippet: '\\subsection{}\n', offset: -2 },
      { icon: 'M5 4h3M5 8h8M5 12h5', title: 'Подподсекция', snippet: '\\subsubsection{}\n', offset: -2 },
    ],
  },
  {
    items: [
      { label: '$', title: 'Inline формула', snippet: '$', suffix: '$', cls: 'text-base' },
      { label: '$$', title: 'Display формула', snippet: '\\[\n', suffix: '\n\\]', cls: 'text-[10px]' },
      {
        label: 'eq',
        title: 'equation',
        snippet: '\\begin{equation}\n  \n\\end{equation}\n',
        cls: 'text-[9px] font-mono',
      },
      { label: 'al', title: 'align', snippet: '\\begin{align}\n  \n\\end{align}\n', cls: 'text-[9px] font-mono' },
    ],
  },
  {
    items: [
      { label: '∑', title: 'Сумма', snippet: '\\sum_{i=1}^{n} ', cls: 'text-base' },
      { label: '∫', title: 'Интеграл', snippet: '\\int_{a}^{b} ', cls: 'text-base' },
      { label: 'x/y', title: 'Дробь', snippet: '\\frac{}{} ', cls: 'text-[10px]' },
      { label: '√', title: 'Корень', snippet: '\\sqrt{} ', cls: 'text-base' },
    ],
  },
  {
    items: [
      {
        icon: 'M3 3v4h4M3 9h6M3 13h6M9 3v10',
        title: 'Маркированный список',
        snippet: '\\begin{itemize}\n  \\item \n\\end{itemize}\n',
      },
      {
        icon: 'M4 3h1M4 7h1M4 11h1M7 3h5M7 7h5M7 11h5',
        title: 'Нумерованный список',
        snippet: '\\begin{enumerate}\n  \\item \n\\end{enumerate}\n',
      },
    ],
  },
  {
    items: [
      {
        icon: 'M2 2h8v6H2zM2 10h8v2H2z',
        title: 'Рисунок',
        snippet:
          '\\begin{figure}[h]\n  \\centering\n  \\includegraphics[width=0.8\\textwidth]{}\n  \\caption{}\n  \\label{fig:}\n\\end{figure}\n',
      },
      {
        icon: 'M2 2h10v10H2zM2 5h10M6 2v10',
        title: 'Таблица',
        snippet:
          '\\begin{table}[h]\n  \\centering\n  \\begin{tabular}{|c|c|}\n    \\hline\n    A & B \\\\\\\\\n    \\hline\n  \\end{tabular}\n  \\caption{}\n  \\label{tab:}\n\\end{table}\n',
      },
      { label: '\\{\\}', title: 'Окружение', snippet: '\\begin{}\n\n\\end{}\n', cls: 'font-mono text-[9px]' },
    ],
  },
  {
    items: [
      { label: 'ref', title: 'Ссылка', snippet: '\\ref{', suffix: '}', cls: 'text-[9px] font-mono' },
      { label: 'cite', title: 'Цитата', snippet: '\\cite{', suffix: '}', cls: 'text-[9px] font-mono' },
      { label: 'fn', title: 'Сноска', snippet: '\\footnote{', suffix: '}', cls: 'text-[9px] font-mono' },
      { label: 'lbl', title: 'Метка', snippet: '\\label{', suffix: '}', cls: 'text-[9px] font-mono' },
    ],
  },
];
</script>

<template>
  <div
    class="flex items-center gap-0.5 px-2 py-0.5 border-b border-white/[0.04] bg-leti-blue-dark/20 overflow-x-auto flex-shrink-0"
  >
    <template v-for="(group, gi) in groups" :key="gi">
      <div v-if="gi > 0" class="w-px h-4 bg-white/[0.06] mx-1 flex-shrink-0" />
      <button
        v-for="(item, ii) in group.items"
        :key="'g' + gi + '-' + ii"
        :data-tip="item.title"
        class="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded text-[11px] text-white/50 hover:text-white hover:bg-white/[0.06] transition-all"
        :class="item.cls"
        @click="emit('insert', item.snippet + (item.suffix || ''))"
      >
        <svg v-if="item.icon" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5">
          <path :d="item.icon" />
        </svg>
        <span v-else>{{ item.label }}</span>
      </button>
    </template>
    <template v-if="(customSnippets || []).length">
      <div class="w-px h-4 bg-white/[0.06] mx-1 flex-shrink-0" />
      <button
        v-for="(item, idx) in customSnippets"
        :key="'c' + idx"
        :data-tip="item.title || item.label"
        class="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded text-[10px] text-leti-gold/70 hover:text-leti-gold hover:bg-white/[0.06] transition-all font-mono"
        @click="emit('insert', item.snippet)"
      >
        {{ item.label }}
      </button>
    </template>
    <div class="w-px h-4 bg-white/[0.06] mx-1 flex-shrink-0" />
    <button
      data-tip="Добавить свой сниппет"
      class="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded text-white/30 hover:text-leti-gold/80 hover:bg-white/[0.06] transition-all"
      @click="emit('add-snippet')"
    >
      <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2v8M2 6h8" /></svg>
    </button>
  </div>
</template>
