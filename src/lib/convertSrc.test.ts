import { expect, describe, it } from "vitest";
import { convertSrc, isAlreadyScriptSetup, hasScript } from "./convertSrc";

describe("snapshot", () => {
  it("lang=js", () => {
    const output = convertSrc(`<script>
import { defineComponent, toRefs, computed, ref } from 'vue';

export default defineComponent({
  name: 'HelloWorld',
  emits: {
    change: null
  },
  props: {
    msg: {
      type: String,
      default: 'HelloWorld'
    },
    foo: {
      type: String,
      required: true,
    }
  },
  setup(props, ctx) {
    const { msg, foo } = toRefs(props);
    const newMsg = computed(() => msg.value + '- HelloWorld');

    const count = ref(0);

    return {
      count,
      newMsg
    }
  }
})
</script>`);
    expect(output).toMatchSnapshot();
  });

  it("lang=ts", () => {
    const output = convertSrc(`<script lang="ts">
import { defineComponent, toRefs, computed, ref } from 'vue';

export default defineComponent({
  name: 'HelloWorld',
  emits: {
    change: (value: number) => true,
  },
  props: {
    msg: {
      type: String,
      default: 'HelloWorld'
    },
    foo: {
      type: String
      required: true,
    }
  },
  setup(props, ctx) {
    const { msg, foo } = toRefs(props);
    const newMsg = computed(() => msg.value + '- HelloWorld');

    const count = ref(0);
    ctx.emit("change", 124);

    return {
      count,
      newMsg
    }
  }
})
</script>`);
    expect(output).toMatchSnapshot();
  });

  it("defineNuxtComponent", () => {
    const output = convertSrc(`<script lang="ts">
import { defineNuxtComponent, useNuxtApp } from '#imports';

export default defineNuxtComponent({
  name: 'HelloWorld',
  layout: 'test-layout',
  middleware: 'test-middleware',
  setup(props, ctx) {
    const { $client } = useNuxtApp();

    const onSubmit = () => {
      console.log('onSubmit')
    }

    return {
      onSubmit,
    }
  }
})
</script>
`);
    expect(output).toMatchSnapshot();
  });

  it("empty setup context", () => {
    const output = convertSrc(`<script lang="ts">
import { defineComponent, toRefs, computed } from 'vue';

export default defineComponent({
  name: 'HelloWorld',
  props: {
    msg: {
      type: String,
      default: 'HelloWorld'
    }
  },
  setup(props) {
    const { msg } = toRefs(props);
    const newMsg = computed(() => msg.value + '- HelloWorld');

    return {
      newMsg
    }
  }
})
</script>`);
    expect(output).toMatchInlineSnapshot(
      `
      "<script setup lang="ts">
      import { toRefs, computed } from "vue";
      type Props = { msg?: string; };
      const { msg = 'HelloWorld' } = defineProps<Props>();

      const { msg } = toRefs(props);
      const newMsg = computed(() => msg.value + '- HelloWorld');
      </script>"
    `
    );
  });

  it("props no toRefs", () => {
    const output = convertSrc(`<script lang="ts">
    import type { PropType } from 'vue';
import { defineComponent, computed } from 'vue';

export default defineComponent({
  name: 'HelloWorld',
  props: {
    msg: {
      type: String,
      default: 'HelloWorld'
    }
  },
  setup(props) {
    const newMsg = computed(() => props.msg + '- HelloWorld');

    return {
      newMsg
    }
  }
})
</script>`);
    expect(output).toMatchInlineSnapshot(
      `
      "<script setup lang="ts">
      import { computed } from "vue";
      import type { PropType } from 'vue';
      type Props = { msg?: string; };
      const { msg = 'HelloWorld' } = defineProps<Props>();

      const newMsg = computed(() => msg + '- HelloWorld');
      </script>"
    `
    );
  });

  it("should be converted to defineAsyncComponent", () => {
    const output = convertSrc(`<script>
import { defineComponent } from 'vue';
import HelloWorld from './HelloWorld.vue';

export default defineComponent({
  components: {
    HelloWorld,
    MyComp: () => import('./MyComp.vue'),
    Foo: () => import('./Foo.vue'),
  }
  })
  </script>`);
    expect(output).toMatchInlineSnapshot(`
      "<script setup>
      import { defineAsyncComponent } from "vue";
      import HelloWorld from './HelloWorld.vue';
      const MyComp = defineAsyncComponent(() => import('./MyComp.vue'));
      const Foo = defineAsyncComponent(() => import('./Foo.vue'));
      </script>"
    `);
  });

  it("should not be empty import", () => {
    const output = convertSrc(`<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  emits: ['click'],
  setup(_, { emit }) {
    const click = () => {
      emit('click')
    }
    return { click }
  },
})
</script>`);
    expect(output).toMatchInlineSnapshot(`
      "<script setup lang="ts">
      const emit = defineEmits(['click']);

      const click = () => {
        emit('click');
      };
      </script>"
    `);
  });

  it("should convert useAttrs and inheritAttrs", () => {
    const output = convertSrc(`<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  inheritAttrs: false,
  setup(_, { attrs }) {
    return {
      attrs,
    }
  },
})
</script>`);
    expect(output).toMatchInlineSnapshot(`
      "<script setup lang="ts">
      import { useAttrs } from "vue";
      defineOptions({
        inheritAttrs: false
      });
      const attrs = useAttrs();
      </script>"
    `);
  });

  it("should replace props references with destructured names", () => {
    const output = convertSrc(`<script lang="ts">
import { computed, defineComponent } from 'vue'

export default defineComponent({
  props: {
    from: {
      type: Number,
      required: true,
    },
    to: {
      type: Number,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
    isLoading: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    const isFirst = computed(() => props.from === 1)
    const isLast = computed(() => props.to === props.total)
    const isDisabled = computed(() => props.isLoading)

    return {
      isFirst,
      isLast,
      isDisabled,
    }
  },
})
</script>`);
    expect(output).toContain("const isFirst = computed(() => from === 1)");
    expect(output).toContain("const isLast = computed(() => to === total)");
    expect(output).toContain("const isDisabled = computed(() => isLoading)");
    expect(output).toContain(
      "const { from, to, total, isLoading = false } = defineProps<Props>();"
    );
  });

  it("should convert empty defineComponent to minimal script setup", () => {
    const output = convertSrc(`<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({})
</script>`);
    expect(output).toMatchInlineSnapshot(`
      "<script setup lang="ts">
      </script>"
    `);
  });

  it("should convert empty defineComponent without lang attribute", () => {
    const output = convertSrc(`<script>
import { defineComponent } from 'vue'

export default defineComponent({})
</script>`);
    expect(output).toMatchInlineSnapshot(`
      "<script setup>
      </script>"
    `);
  });

  describe("import duplication issues", () => {
    it("should not duplicate imports from #imports", () => {
      const input = `<template>
  <div class="searchNoResult" >
    <div class="searchNoResult-empty">
      <div>
        <UserIcon />
        <div>
          No results found.<br />Please try different search criteria.
        </div>
        <Button
          @click="goSearch"
          >Edit Criteria</Button
        >
      </div>
    </div>
    <div class="globalFooter">
      <PortalTarget name="global-footer" />
    </div>
  </div>
</template>

<script lang="ts">
import { useRoute, useRouter } from '#imports'
import { defineComponent } from 'vue'

import UserIcon from '~/assets/icons/user-icon.svg'

export default defineComponent({
  name: 'SearchNoResult',
  components: {
    UserIcon,
  },
  setup(_) {
    const router = useRouter()
    const route = useRoute()

    const goSearch = () => {
      const query = { ...route.query }
      delete query.page

      router.push({
        path: '/search',
        query,
      })
    }

    return {
      goSearch,
    }
  },
})
</script>`;

      const result = convertSrc(input);

      // Check that useRoute and useRouter are imported only once
      const importLines = result
        .split("\n")
        .filter((line) => line.includes("import"));
      const importsFromSharpImports = importLines.filter(
        (line) => line.includes("#imports") || line.includes('"#imports"')
      );

      // Should have only one import from #imports
      expect(importsFromSharpImports).toHaveLength(1);

      // Check that the import contains both useRoute and useRouter
      const importLine = importsFromSharpImports[0];
      expect(importLine).toContain("useRoute");
      expect(importLine).toContain("useRouter");

      // Check that there are no duplicate import lines
      const uniqueImportLines = [...new Set(importLines)];
      expect(importLines).toHaveLength(uniqueImportLines.length);
    });

    it("should not duplicate imports from vue", () => {
      const input = `<script lang="ts">
import { defineComponent, ref, computed } from 'vue'
import { useRoute } from '#imports'

export default defineComponent({
  setup() {
    const count = ref(0)
    const doubled = computed(() => count.value * 2)
    
    return {
      count,
      doubled
    }
  }
})
</script>`;

      const result = convertSrc(input);

      // Check that vue imports are not duplicated
      const importLines = result
        .split("\n")
        .filter((line) => line.includes("import"));
      const vueImports = importLines.filter(
        (line) => line.includes('from "vue"') || line.includes("from 'vue'")
      );

      // Should have only one import from vue (if any)
      expect(vueImports.length).toBeLessThanOrEqual(1);

      // Check for duplicate lines
      const uniqueImportLines = [...new Set(importLines)];
      expect(importLines).toHaveLength(uniqueImportLines.length);
    });

    it("should preserve other imports correctly", () => {
      const input = `<script lang="ts">
import { useRoute, useRouter } from '#imports'
import { defineComponent } from 'vue'
import UserIcon from '~/assets/icons/user-icon.svg'
import { someUtility } from '~/utils/helper'

export default defineComponent({
  components: {
    UserIcon,
  },
  setup() {
    const router = useRouter()
    const route = useRoute()
    
    return {
      router,
      route
    }
  }
})
</script>`;

      const result = convertSrc(input);

      // Should preserve non-vue/non-#imports imports
      expect(result).toContain("from '~/assets/icons/user-icon.svg'");
      expect(result).toContain("from '~/utils/helper'");

      // Should not duplicate imports
      const importLines = result
        .split("\n")
        .filter((line) => line.includes("import"));
      const uniqueImportLines = [...new Set(importLines)];
      expect(importLines).toHaveLength(uniqueImportLines.length);
    });
  });
});

describe("script setup detection and skip", () => {
  it("should detect script setup files", () => {
    const scriptSetupFile = `<template>
  <div>{{ msg }}</div>
</template>

<script setup lang="ts">
const msg = 'Hello World'
</script>`;

    expect(isAlreadyScriptSetup(scriptSetupFile)).toBe(true);
  });

  it("should not detect regular script as script setup", () => {
    const regularScriptFile = `<template>
  <div>{{ msg }}</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  setup() {
    const msg = 'Hello World'
    return { msg }
  }
})
</script>`;

    expect(isAlreadyScriptSetup(regularScriptFile)).toBe(false);
  });

  it("should skip conversion for script setup files", () => {
    const scriptSetupFile = `<template>
  <div>{{ msg }}</div>
</template>

<script setup lang="ts">
const msg = 'Hello World'
</script>`;

    const result = convertSrc(scriptSetupFile);
    expect(result).toBe(scriptSetupFile);
  });
});

describe("no script section handling", () => {
  it("should detect files with script section", () => {
    const fileWithScript = `<template>
  <div>Hello World</div>
</template>

<script>
export default {
  name: 'HelloWorld'
}
</script>`;

    expect(hasScript(fileWithScript)).toBe(true);
  });

  it("should detect files without script section", () => {
    const fileWithoutScript = `<template>
  <div>Hello World</div>
</template>

<style scoped>
div {
  color: red;
}
</style>`;

    expect(hasScript(fileWithoutScript)).toBe(false);
  });

  it("should skip conversion for files without script section", () => {
    const templateOnlyFile = `<template>
  <div>Hello World</div>
</template>

<style scoped>
div {
  color: red;
}
</style>`;

    const result = convertSrc(templateOnlyFile);
    expect(result).toBe(templateOnlyFile);
  });

  it("should skip conversion for template-only files", () => {
    const templateOnlyFile = `<template>
  <div class="container">
    <h1>Welcome</h1>
    <p>This is a template-only component</p>
  </div>
</template>`;

    const result = convertSrc(templateOnlyFile);
    expect(result).toBe(templateOnlyFile);
  });
});
