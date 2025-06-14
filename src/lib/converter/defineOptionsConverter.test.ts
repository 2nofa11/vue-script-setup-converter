import { expect, describe, it } from "vitest";
import { CallExpression, ScriptTarget, SyntaxKind, Project } from "ts-morph";
import { parse } from "@vue/compiler-sfc";
import { getNodeByKind } from "../helpers/node";
import { convertDefineOptions } from "./defineOptionsConverter";

const parseScript = (input: string) => {
  const {
    descriptor: { script },
  } = parse(input);

  const project = new Project({
    tsConfigFilePath: "tsconfig.json",
    compilerOptions: {
      target: ScriptTarget.Latest,
    },
  });

  const sourceFile = project.createSourceFile("s.tsx", script?.content ?? "");
  const callexpression = getNodeByKind(sourceFile, SyntaxKind.CallExpression);

  return convertDefineOptions(callexpression as CallExpression);
};

describe("defineOptions converter", () => {
  it("converts inheritAttrs", () => {
    const source = `<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  inheritAttrs: false,
  setup() {
    return {}
  }
})
</script>`;
    
    const output = parseScript(source);
    expect(output).toMatchInlineSnapshot(`
      "defineOptions({
        inheritAttrs: false
      });"
    `);
  });

  it("ignores props, emits, setup, components", () => {
    const source = `<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  props: { msg: String },
  emits: ['click'],
  components: {},
  setup() {
    return {}
  }
})
</script>`;
    
    const output = parseScript(source);
    expect(output).toBe("");
  });

  it("converts multiple options", () => {
    const source = `<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  inheritAttrs: false,
  directives: {
    focus: {
      mounted(el) {
        el.focus()
      }
    }
  },
  setup() {
    return {}
  }
})
</script>`;
    
    const output = parseScript(source);
    expect(output).toContain("inheritAttrs: false");
    expect(output).toContain("directives:");
  });
});