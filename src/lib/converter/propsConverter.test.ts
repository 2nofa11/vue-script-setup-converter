import { expect, describe, it } from "vitest";
import { CallExpression, ScriptTarget, SyntaxKind, Project } from "ts-morph";
import { parse } from "@vue/compiler-sfc";
import { getNodeByKind } from "../helpers/node";
import { convertProps } from "./propsConverter";

const parseScript = (input: string, lang: "js" | "ts" = "js") => {
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

  const propsResult = convertProps(callexpression as CallExpression, lang);

  return propsResult.code;
};

const source = `<script>
  import { defineComponent, toRefs, computed, ref } from 'vue';
  
  export default defineComponent({
    name: 'UserCard',
    props: {
      title: {
        type: String,
        default: 'Welcome'
      },
      userId: {
        type: String,
        required: true
      }
    }
  })
  </script>`;

describe("basic", () => {
  it("defineProps", () => {
    const output = parseScript(source);

    expect(output).toMatchInlineSnapshot(`
      "const props = defineProps({title: {
              type: String,
              default: 'Welcome'
            },userId: {
              type: String,
              required: true
            }});"
    `);
  });

  it("type-based defineProps", () => {
    const output = parseScript(source, "ts");

    expect(output).toMatchInlineSnapshot(`
      "type Props = {title?: string;
      userId: string;};const { title = 'Welcome', userId } = defineProps<Props>();"
    `);
  });

  it("custom validator", () => {
    const source = `<script>
  import { defineComponent, toRefs, computed, ref } from 'vue';
  
  export default defineComponent({
    name: 'StatusAlert',
    props: {
      message: {
        type: String,
        default: 'Info'
      },
      status: {
        type: String,
        required: true,
        validator(value) {
          return ["success", "warning", "danger"].includes(value)
        }
      }
    }
  })
  </script>`;
    const output = parseScript(source);

    expect(output).toMatchInlineSnapshot(`
      "const props = defineProps({message: {
              type: String,
              default: 'Info'
            },status: {
              type: String,
              required: true,
              validator(value) {
                return ["success", "warning", "danger"].includes(value)
              }
            }});"
    `);
  });
});

describe("type-based", () => {
  it("require and default", () => {
    const source = `<script lang="ts">
  import { defineComponent, toRefs, computed, ref } from 'vue';
  
  export default defineComponent({
    name: 'HelloWorld',
    props: {
      msg: {
        type: String,
        required: true,
        default: 'HelloWorld'
      },
      foo: {
        type: String,
        required: true
      }
    }
  })
  </script>`;
    const output = parseScript(source, "ts");

    expect(output).toMatchInlineSnapshot(`
      "type Props = {msg?: string;
      foo: string;};const { msg = 'HelloWorld', foo } = defineProps<Props>();"
    `);
  });

  it("default function", () => {
    const source = `<script lang="ts">
  import { defineComponent, toRefs, computed, ref } from 'vue';
  
  export default defineComponent({
    name: 'HelloWorld',
    props: {
      foo: {
        type: Object,
        default() {
          return { msg: "Hello World" }
        }
      },
      bar: {
        type: Array,
        default() {
          return ["foo", "bar"]
        }
      }
    }
  })
  </script>`;
    const output = parseScript(source, "ts");

    expect(output).toMatchInlineSnapshot(`
      "type Props = {foo?: { msg: string; };
      bar?: string[];};const { foo = { msg: "Hello World" }, bar = ["foo", "bar"] } = defineProps<Props>();"
    `);
  });

  it("default arrow function", () => {
    const source = `<script lang="ts">
  import { defineComponent, toRefs, computed, ref } from 'vue';
  
  export default defineComponent({
    name: 'HelloWorld',
    props: {
      foo: {
        type: Object,
        default: () => ({ msg: "Hello World" })
      },
      bar: {
        type: Array,
        default: () => ["foo", "bar"]
      }
    }
  })
  </script>`;
    const output = parseScript(source, "ts");

    expect(output).toMatchInlineSnapshot(`
      "type Props = {foo?: { msg: string; };
      bar?: string[];};const { foo = { msg: "Hello World" }, bar = ["foo", "bar"] } = defineProps<Props>();"
    `);
  });

  it("default arrow function and return", () => {
    const source = `<script lang="ts">
  import { defineComponent, toRefs, computed, ref } from 'vue';
  
  export default defineComponent({
    name: 'HelloWorld',
    props: {
      foo: {
        type: Object,
        default: () => {
          return { msg: "Hello World" }
        }
      },
      bar: {
        type: Array,
        default: () => {
          return ["foo", "bar"]
        }
      }
    }
  })
  </script>`;
    const output = parseScript(source, "ts");

    expect(output).toMatchInlineSnapshot(`
      "type Props = {foo?: { msg: string; };
      bar?: string[];};const { foo = { msg: "Hello World" }, bar = ["foo", "bar"] } = defineProps<Props>();"
    `);
  });

  it("non primitive", () => {
    const source = `<script lang="ts">
  import { defineComponent, toRefs, computed, ref, PropType } from 'vue';
  import { Foo } from './Foo';
  
  export default defineComponent({
    name: 'HelloWorld',
    props: {
      foo: {
        type: Object as PropType<Foo>,
        required: true
      },
      items: {
        type: Array as PropType<string[]>,
        required: true
      }
    }
  })
  </script>`;
    const output = parseScript(source, "ts");

    expect(output).toMatchInlineSnapshot(`
      "type Props = {foo: Foo;
      items: string[];};const { foo, items } = defineProps<Props>();"
    `);
  });

  it("non Object style", () => {
    const source = `<script lang="ts">
  import { defineComponent, toRefs, computed, ref, PropType } from 'vue';
  import { Foo } from './Foo';
  
  export default defineComponent({
    name: 'HelloWorld',
    props: {
      msg: String,
      foo: Object as PropType<Foo>
    }
  })
  </script>`;
    const output = parseScript(source, "ts");

    expect(output).toMatchInlineSnapshot(`
      "type Props = {msg?: string;
      foo?: Foo;};const { msg, foo } = defineProps<Props>();"
    `);
  });

  it("default value is boolean", () => {
    const source = `<script lang="ts">
  import { defineComponent, toRefs, computed, ref } from 'vue';
  
  export default defineComponent({
    name: 'HelloWorld',
    props: {
      msg: {
        type: String,
        required: true
      },
      disabled: {
        type: Boolean,
        default: false
      }
    }
  })
  </script>`;
    const output = parseScript(source, "ts");

    expect(output).toMatchInlineSnapshot(`
      "type Props = {msg: string;
      disabled?: boolean;};const { msg, disabled = false } = defineProps<Props>();"
    `);
  });
});
