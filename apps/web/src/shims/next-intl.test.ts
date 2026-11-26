import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider, useTranslations, type Translator } from './next-intl';

test('translator identity survives a component rerender so dependent memo values remain cached', () => {
  let renders = 0;
  function Probe() {
    const t = useTranslations('example');
    const first = useRef<Translator>(t);
    const [rerender, setRerender] = useState(false);
    renders++;
    assert.equal(t, first.current);
    assert.equal(t('greeting', { name: '世界' }), '你好 世界');
    assert.equal(t.has('greeting'), true);
    assert.equal(t.raw('greeting'), '你好 {name}');
    if (!rerender) setRerender(true);
    return null;
  }
  renderToStaticMarkup(createElement(NextIntlClientProvider, {
    locale: 'zh', messages: { example: { greeting: '你好 {name}' } },
  }, createElement(Probe)));
  assert.equal(renders, 2);
});

test('translator updates when its namespace changes', () => {
  function Probe() {
    const [namespace, setNamespace] = useState('a');
    const t = useTranslations(namespace);
    const initial = useRef(t);
    if (namespace === 'a') setNamespace('b');
    else {
      assert.notEqual(t, initial.current);
      assert.equal(t('label'), 'B');
    }
    return null;
  }
  renderToStaticMarkup(createElement(NextIntlClientProvider, {
    messages: { a: { label: 'A' }, b: { label: 'B' } },
  }, createElement(Probe)));
});
