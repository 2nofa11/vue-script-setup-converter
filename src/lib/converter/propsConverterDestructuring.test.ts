import { expect, describe, it } from "vitest";
import { CallExpression, ScriptTarget, SyntaxKind, Project } from "ts-morph";
import { parse } from "@vue/compiler-sfc";
import { getNodeByKind } from "../helpers/node";
import { convertPropsToDestructuring } from "./propsConverter";

// テスト用のヘルパー関数
const parseScript = (input: string, lang: "js" | "ts" = "ts") => {
  const {
    descriptor: { script },
  } = parse(input);

  const project = new Project({
    compilerOptions: {
      target: ScriptTarget.Latest,
    },
    useInMemoryFileSystem: true,
  });

  const sourceFile = project.createSourceFile("s.tsx", script?.content ?? "");
  const callexpression = getNodeByKind(sourceFile, SyntaxKind.CallExpression);

  return callexpression as CallExpression;
};

describe("Destructuring Props Converter - Basic Cases", () => {
  it("simple default value", () => {
    const source = `<script lang="ts">
  import { defineComponent } from 'vue';
  
  export default defineComponent({
    props: {
      msg: {
        type: String,
        default: 'hello'
      }
    }
  })
  </script>`;

    const callExpression = parseScript(source, "ts");
    const result = convertPropsToDestructuring(callExpression, "ts");

    // 期待される出力: "const { msg = 'hello' } = defineProps<Props>();"
    expect(result).toBe(
      "type Props = {msg?: string;};const { msg = 'hello' } = defineProps<Props>();"
    );
  });

  it("multiple props with mixed defaults", () => {
    const source = `<script lang="ts">
  import { defineComponent } from 'vue';
  
  export default defineComponent({
    props: {
      msg: {
        type: String,
        default: 'hello'
      },
      count: {
        type: Number,
        required: true
      },
      enabled: {
        type: Boolean,
        default: true
      }
    }
  })
  </script>`;

    const callExpression = parseScript(source, "ts");
    const result = convertPropsToDestructuring(callExpression, "ts");

    // 期待される出力: "const { msg = 'hello', count, enabled = true } = defineProps<Props>();"
    expect(result).toBe(
      "type Props = {msg?: string;\ncount: number;\nenabled?: boolean;};const { msg = 'hello', count, enabled = true } = defineProps<Props>();"
    );
  });

  it("no default props - all required", () => {
    const source = `<script lang="ts">
  import { defineComponent } from 'vue';
  
  export default defineComponent({
    props: {
      msg: {
        type: String,
        required: true
      },
      count: {
        type: Number,
        required: true
      }
    }
  })
  </script>`;

    const callExpression = parseScript(source, "ts");
    const result = convertPropsToDestructuring(callExpression, "ts");

    // 期待される出力: "const { msg, count } = defineProps<Props>();"
    expect(result).toBe(
      "type Props = {msg: string;\ncount: number;};const { msg, count } = defineProps<Props>();"
    );
  });
});

describe("Destructuring Props Converter - Complex Default Values", () => {
  it("array default with arrow function", () => {
    const source = `<script lang="ts">
  import { defineComponent } from 'vue';
  
  export default defineComponent({
    props: {
      labels: {
        type: Array,
        default: () => ['one', 'two']
      }
    }
  })
  </script>`;

    const callExpression = parseScript(source, "ts");
    const result = convertPropsToDestructuring(callExpression, "ts");

    // 期待される出力: "const { labels = ['one', 'two'] } = defineProps<Props>();"
    expect(result).toBe(
      "type Props = {labels?: string[];};const { labels = ['one', 'two'] } = defineProps<Props>();"
    );
  });

  it("object default with arrow function", () => {
    const source = `<script lang="ts">
  import { defineComponent } from 'vue';
  
  export default defineComponent({
    props: {
      config: {
        type: Object,
        default: () => ({ key: 'value' })
      }
    }
  })
  </script>`;

    const callExpression = parseScript(source, "ts");
    const result = convertPropsToDestructuring(callExpression, "ts");

    // 期待される出力: "const { config = { key: 'value' } } = defineProps<Props>();"
    expect(result).toBe(
      "type Props = {config?: { key: string; };};const { config = { key: 'value' } } = defineProps<Props>();"
    );
  });

  it("function default method", () => {
    const source = `<script lang="ts">
  import { defineComponent } from 'vue';
  
  export default defineComponent({
    props: {
      items: {
        type: Array,
        default() {
          return ['one', 'two']
        }
      }
    }
  })
  </script>`;

    const callExpression = parseScript(source, "ts");
    const result = convertPropsToDestructuring(callExpression, "ts");

    // 期待される出力: "const { items = ['one', 'two'] } = defineProps<Props>();"
    expect(result).toBe(
      "type Props = {items?: string[];};const { items = ['one', 'two'] } = defineProps<Props>();"
    );
  });

  it("boolean and number default values", () => {
    const source = `<script lang="ts">
  import { defineComponent } from 'vue';
  
  export default defineComponent({
    props: {
      enabled: {
        type: Boolean,
        default: false
      },
      count: {
        type: Number,
        default: 0
      },
      max: {
        type: Number,
        default: 100
      }
    }
  })
  </script>`;

    const callExpression = parseScript(source, "ts");
    const result = convertPropsToDestructuring(callExpression, "ts");

    // 期待される出力: "const { enabled = false, count = 0, max = 100 } = defineProps<Props>();"
    expect(result).toBe(
      "type Props = {enabled?: boolean;\ncount?: number;\nmax?: number;};const { enabled = false, count = 0, max = 100 } = defineProps<Props>();"
    );
  });
});

describe("Destructuring Props Converter - Edge Cases", () => {
  it("props with validators should use destructuring but preserve complex behavior", () => {
    const source = `<script lang="ts">
  import { defineComponent } from 'vue';
  
  export default defineComponent({
    props: {
      status: {
        type: String,
        default: 'pending',
        validator(value: string) {
          return ['pending', 'success', 'error'].includes(value)
        }
      }
    }
  })
  </script>`;

    const callExpression = parseScript(source, "ts");
    const result = convertPropsToDestructuring(callExpression, "ts");

    // バリデーター付きpropsでもdestructuring記法を使用
    // （バリデーターは実行時チェックなので、destructuringと共存可能）
    expect(result).toBe(
      "type Props = {status?: string;};const { status = 'pending' } = defineProps<Props>();"
    );
  });

  it("mixed PropType with defaults", () => {
    const source = `<script lang="ts">
  import { defineComponent, PropType } from 'vue';
  
  interface CustomType {
    id: number;
    name: string;
  }
  
  export default defineComponent({
    props: {
      data: {
        type: Object as PropType<CustomType>,
        default: () => ({ id: 1, name: 'default' })
      }
    }
  })
  </script>`;

    const callExpression = parseScript(source, "ts");
    const result = convertPropsToDestructuring(callExpression, "ts");

    // 期待される出力: "const { data = { id: 1, name: 'default' } } = defineProps<Props>();"
    expect(result).toBe(
      "type Props = {data?: { id: number; name: string; };};const { data = { id: 1, name: 'default' } } = defineProps<Props>();"
    );
  });

  it("empty props object", () => {
    const source = `<script lang="ts">
  import { defineComponent } from 'vue';
  
  export default defineComponent({
    props: {}
  })
  </script>`;

    const callExpression = parseScript(source, "ts");
    const result = convertPropsToDestructuring(callExpression, "ts");

    expect(result).toBe("type Props = {};const {  } = defineProps<Props>();");
  });

  it("single required prop", () => {
    const source = `<script lang="ts">
  import { defineComponent } from 'vue';
  
  export default defineComponent({
    props: {
      id: {
        type: Number,
        required: true
      }
    }
  })
  </script>`;

    const callExpression = parseScript(source, "ts");
    const result = convertPropsToDestructuring(callExpression, "ts");

    expect(result).toBe(
      "type Props = {id: number;};const { id } = defineProps<Props>();"
    );
  });

  it("all optional props with defaults", () => {
    const source = `<script lang="ts">
  import { defineComponent } from 'vue';
  
  export default defineComponent({
    props: {
      title: {
        type: String,
        default: 'Default Title'
      },
      visible: {
        type: Boolean,
        default: true
      },
      count: {
        type: Number,
        default: 0
      }
    }
  })
  </script>`;

    const callExpression = parseScript(source, "ts");
    const result = convertPropsToDestructuring(callExpression, "ts");

    expect(result).toBe(
      "type Props = {title?: string;\nvisible?: boolean;\ncount?: number;};const { title = 'Default Title', visible = true, count = 0 } = defineProps<Props>();"
    );
  });

  it("mixed required and optional props", () => {
    const source = `<script lang="ts">
  import { defineComponent } from 'vue';
  
  export default defineComponent({
    props: {
      id: {
        type: String,
        required: true
      },
      title: {
        type: String,
        default: 'Untitled'
      },
      enabled: {
        type: Boolean,
        required: true
      },
      maxLength: {
        type: Number,
        default: 100
      }
    }
  })
  </script>`;

    const callExpression = parseScript(source, "ts");
    const result = convertPropsToDestructuring(callExpression, "ts");

    expect(result).toBe(
      "type Props = {id: string;\ntitle?: string;\nenabled: boolean;\nmaxLength?: number;};const { id, title = 'Untitled', enabled, maxLength = 100 } = defineProps<Props>();"
    );
  });

  it("complex nested object defaults", () => {
    const source = `<script lang="ts">
  import { defineComponent } from 'vue';
  
  export default defineComponent({
    props: {
      config: {
        type: Object,
        default: () => ({
          theme: 'light',
          settings: {
            autoSave: true,
            timeout: 5000
          }
        })
      }
    }
  })
  </script>`;

    const callExpression = parseScript(source, "ts");
    const result = convertPropsToDestructuring(callExpression, "ts");

    expect(result).toBe(
      "type Props = {config?: { theme: string; settings: { autoSave: boolean; timeout: number; }; };};const { config = {\n          theme: 'light',\n          settings: {\n            autoSave: true,\n            timeout: 5000\n          }\n        } } = defineProps<Props>();"
    );
  });

  it("array with mixed types default", () => {
    const source = `<script lang="ts">
  import { defineComponent } from 'vue';
  
  export default defineComponent({
    props: {
      items: {
        type: Array,
        default: () => [1, 'string', true, { key: 'value' }]
      }
    }
  })
  </script>`;

    const callExpression = parseScript(source, "ts");
    const result = convertPropsToDestructuring(callExpression, "ts");

    expect(result).toBe(
      "type Props = {items?: (string | number | boolean | { key: string; })[];};const { items = [1, 'string', true, { key: 'value' }] } = defineProps<Props>();"
    );
  });

  it("function as default value", () => {
    const source = `<script lang="ts">
  import { defineComponent } from 'vue';
  
  export default defineComponent({
    props: {
      formatter: {
        type: Function,
        default: () => (value: string) => value.toUpperCase()
      }
    }
  })
  </script>`;

    const callExpression = parseScript(source, "ts");
    const result = convertPropsToDestructuring(callExpression, "ts");

    expect(result).toBe(
      "type Props = {formatter?: Function;};const { formatter = (value: string) => value.toUpperCase() } = defineProps<Props>();"
    );
  });
});
