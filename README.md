# Vue Script Setup Converter

A powerful tool that transforms Vue Composition API code into modern `<script setup>` syntax with advanced features like props destructuring, automatic reference replacement, and comprehensive TypeScript support.

## 🚀 Project Background

This project builds upon the excellent work of the Vue.js community:

1. **[miyaoka/vue-composition-converter](https://github.com/miyaoka/vue-composition-converter)** (by Masaya Kazama)

   - Original converter: Options API → Composition API
   - Foundation for modern Vue code transformation

2. **[wattanx/vue-script-setup-converter](https://github.com/wattanx/vue-script-setup-converter)**

   - Enhanced converter: Composition API → Script Setup
   - Added TypeScript support and modern Vue 3 features

3. **This Project** (Enhanced Fork)
   - Advanced props destructuring with automatic reference replacement
   - Comprehensive TypeScript interface generation
   - `defineOptions` support for modern Vue 3.3+ features
   - Nuxt.js compatibility with `defineNuxtComponent`
   - Monorepo consolidation and enhanced CLI tools

This project contains code originally from [miyaoka/vue-composition-converter](https://github.com/miyaoka/vue-composition-converter) (MIT License) and builds upon [wattanx/vue-script-setup-converter](https://github.com/wattanx/vue-script-setup-converter).

## Installation & Usage

### Setup (One-time)

```bash
# Clone the repository
git clone <repository-url>
cd vue-script-setup-converter

# Install dependencies and build
npm install
```

### Usage

#### Option 1: Direct execution from project root

```bash
cd /path/to/vue-script-setup-converter
npx . <file-path>
```

#### Option 2: From any workspace (if part of monorepo)

```bash
# In any workspace that depends on this converter
npx vue-script-setup-converter <file-path>
```

#### Option 3: Direct CLI execution

```bash
cd /path/to/vue-script-setup-converter
node dist/cli.mjs <file-path>
```

### Examples

```bash
# Convert a Vue file
npx . ./src/components/MyComponent.vue

# Or with full path
node dist/cli.mjs ./src/components/MyComponent.vue
```

## Example Conversion

**Input:**

```vue
<script lang="ts">
import { computed, defineComponent } from "vue";

export default defineComponent({
  props: {
    count: { type: Number, required: true },
    message: { type: String, default: "Hello" },
  },
  inheritAttrs: false,
  setup(props, { attrs, emit }) {
    const doubled = computed(() => props.count * 2);
    const greeting = computed(() => `${props.message} World`);

    const handleClick = () => {
      emit("click", doubled.value);
    };

    return { doubled, greeting, handleClick, attrs };
  },
});
</script>
```

**Output:**

```vue
<script setup lang="ts">
import { computed, useAttrs } from "vue";

type Props = {
  count: number;
  message?: string;
};
const { count, message = "Hello" } = defineProps<Props>();

defineOptions({
  inheritAttrs: false,
});

const attrs = useAttrs();
const emit = defineEmits(["click"]);

const doubled = computed(() => count * 2);
const greeting = computed(() => `${message} World`);

const handleClick = () => {
  emit("click", doubled.value);
};
</script>
```
