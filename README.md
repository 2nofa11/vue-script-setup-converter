# Vue Script Setup Converter

> ⚠️ **Experimental**: This is an experimental project. Use with caution.

Converts Vue Composition API code to `<script setup>` syntax with TypeScript support.

**Built upon the excellent work of [wattanx/wattanx-converter](https://github.com/wattanx/wattanx-converter). Thank you for the foundation!**

## Installation

```bash
npm install -D vue-script-setup-converter
```

## Usage

```bash
npx vue-script-setup-converter <file-path>
```

## Example

**Input:**
```vue
<script lang="ts">
import { computed, defineComponent } from "vue";

export default defineComponent({
  props: {
    count: { type: Number, required: true },
    message: { type: String, default: "Hello" }
  },
  setup(props) {
    const doubled = computed(() => props.count * 2);
    return { doubled };
  }
});
</script>
```

**Output:**
```vue
<script setup lang="ts">
import { computed } from "vue";

type Props = {
  count: number;
  message?: string;
};
const { count, message = "Hello" } = defineProps<Props>();

const doubled = computed(() => count * 2);
</script>
```

## License

MIT