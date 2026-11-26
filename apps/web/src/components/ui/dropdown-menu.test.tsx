import assert from "node:assert/strict"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { DropdownMenu, DropdownMenuTrigger } from "./dropdown-menu"

function renderTrigger(props: React.ComponentProps<typeof DropdownMenuTrigger>) {
  return renderToStaticMarkup(
    <DropdownMenu>
      <DropdownMenuTrigger {...props} />
    </DropdownMenu>,
  )
}

function assertSingleTrigger(html: string) {
  assert.equal((html.match(/<button\b/g) ?? []).length, 1)
  assert.match(html, /aria-haspopup="true"/)
  assert.match(html, /aria-expanded="false"/)
  assert.doesNotMatch(html, /asChild/i)
}

test("asChild reuses the child button and preserves its content and attributes", () => {
  const html = renderTrigger({
    asChild: true,
    className: "trigger-class",
    children: <button type="button" disabled title="Create categories" className="child-class"><span>Create</span></button>,
  })
  assertSingleTrigger(html)
  assert.match(html, /disabled=""/)
  assert.match(html, /title="Create categories"/)
  assert.match(html, /trigger-class child-class/)
  assert.match(html, /<span>Create<\/span>/)
})

test("default trigger still renders its children", () => {
  const html = renderTrigger({ children: "Open menu" })
  assertSingleTrigger(html)
  assert.match(html, /type="button"/)
  assert.match(html, />Open menu<\/button>/)
})

test("render API preserves existing content and supports explicit children", () => {
  const html = renderTrigger({ render: <button type="button">Original</button> })
  assertSingleTrigger(html)
  assert.match(html, />Original<\/button>/)
  const replaced = renderTrigger({ render: <button type="button">Original</button>, children: "Replacement" })
  assertSingleTrigger(replaced)
  assert.match(replaced, />Replacement<\/button>/)
})
