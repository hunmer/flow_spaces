import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { transform } from "esbuild";
import inspectorPlugin from "./inspector-babel-plugin.ts";

const require = createRequire(import.meta.url);
const inspectorRequire = createRequire(require.resolve("@react-dev-inspector/babel-plugin"));
const reactRequire = createRequire(require.resolve("@vitejs/plugin-react"));
const { transformSync } = inspectorRequire("@babel/core");
const refreshPlugin = reactRequire("react-refresh/babel");
const attributes = [
  "data-inspector-line",
  "data-inspector-column",
  "data-inspector-relative-path",
];

function compile(source, filename, plugins = [inspectorPlugin, [refreshPlugin, { skipEnvCheck: true }]]) {
  return transformSync(source, {
    filename,
    babelrc: false,
    configFile: false,
    ast: true,
    parserOpts: { plugins: ["jsx", "typescript"] },
    plugins,
  });
}

test("React Refresh keeps one inspector location per JSX element in chain-of-thought", async () => {
  const filename = new URL("./src/components/chat/chain-of-thought.tsx", import.meta.url);
  const result = compile(readFileSync(filename, "utf8"), fileURLToPath(filename));
  let inspected = 0;
  inspectorRequire("@babel/traverse").default(result.ast, {
    JSXOpeningElement(path) {
      for (const name of attributes) {
        const matches = path.node.attributes.filter(attribute => attribute.name?.name === name);
        assert.equal(matches.length, 1, `${name} at line ${path.node.loc.start.line}`);
        if (name === "data-inspector-line") {
          assert.equal(matches[0].value.value, String(path.node.loc.start.line));
        }
      }
      inspected++;
    },
  });
  assert.ok(inspected > 0);
  const output = await transform(result.code, { loader: "tsx", jsx: "automatic" });
  assert.deepEqual(output.warnings, []);
});

test("repeated transforms preserve source locations without duplicate attributes", () => {
  const first = compile("export const Example = memo(forwardRef(() => <div><span /></div>));", "example.tsx");
  const second = compile(first.code, "example.tsx", [inspectorPlugin]);
  for (const name of attributes) {
    assert.equal((second.code.match(new RegExp(`${name}=`, "g")) ?? []).length, 2);
  }
});

test("excluded dependencies receive no inspector attributes", () => {
  const result = compile("export const Example = () => <div />;", "node_modules/example/index.tsx", [
    [inspectorPlugin, { excludes: [/[\\/]node_modules[\\/]/] }],
  ]);
  assert.doesNotMatch(result.code, /data-inspector-/);
});
