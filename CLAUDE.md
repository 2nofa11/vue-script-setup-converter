# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Vue Script Setup Converter that transforms Vue composition API code into script setup syntax. The project consists of:

- **Main package**: Core converter library and CLI tool
- **converter-utils**: Shared utility package for TypeScript AST manipulation

## Architecture

The converter uses TypeScript's ts-morph library to parse and transform Vue SFC (Single File Component) script blocks:

1. **Parser**: Uses `@vue/compiler-sfc` to extract script content from Vue files
2. **AST Analysis**: Creates TypeScript AST using ts-morph Project to identify `defineComponent` or `defineNuxtComponent` calls
3. **Converters**: Modular converters transform different aspects:
   - `importDeclarationConverter`: Handles import statements
   - `propsConverter`: Converts props definitions to `defineProps` with destructuring assignment (not using `withDefaults`)
   - `emitsConverter`: Converts emits to `defineEmits`  
   - `setupConverter`: Transforms setup function content and handles props reference replacement
   - `componentsConverter`: Handles component registrations
   - `pageMetaConverter`: Converts Nuxt page meta (for defineNuxtComponent)
   - `defineOptionsConverter`: Converts component options like `inheritAttrs` to `defineOptions`

## Props Conversion Approach

The converter uses **destructuring assignment** approach for props conversion:

**Input (Composition API):**
```javascript
export default defineComponent({
  props: {
    msg: {
      type: String,
      default: 'Hello'
    },
    count: {
      type: Number,
      required: true
    }
  }
})
```

**Output (Script Setup with destructuring):**
```typescript
type Props = {
  msg?: string;
  count: number;
};
const { msg = 'Hello', count } = defineProps<Props>();
```

**Key Features:**
- Default values are preserved in destructuring assignment
- Type safety with TypeScript interface generation
- No `withDefaults` usage - direct destructuring with default values
- Supports complex default values (objects, arrays, functions)
- **Automatic props reference replacement**: `props.propertyName` → `propertyName` in setup function

## Development Commands

### Main Package
```bash
# Build the project
npm run prepack

# Run tests
npm run test

# Watch tests
npm run test:watch

# Update test snapshots
npm run test:update

# Development build with watch
npm run build:watch
```

### Converter Utils Package
```bash
cd converter-utils

# Build utilities
npm run prepack

# Run utility tests
npm run test

# Format code
npm run format
```

## CLI Usage

The built CLI tool can be used as:
```bash
npx vue-script-setup-converter <file-path>
```

## Testing

- Uses Vitest for testing with snapshot testing for conversion outputs
- Test files follow the pattern `*.test.ts` or `*.spec.ts`
- Snapshots are stored in `__snapshots__` directories
- Test timeout is configured to 10 seconds for complex AST operations

## Monorepo Structure

This is a workspace with two packages:
- Root package: Main converter and CLI
- `converter-utils/`: Shared TypeScript utilities

Both packages use unbuild for bundling and support both ESM and CJS outputs.

## Advanced Features

### Props Reference Replacement
When converting TypeScript files with destructured props, the converter automatically replaces `props.propertyName` references in the setup function:

**Input:**
```typescript
export default defineComponent({
  props: {
    count: { type: Number, required: true },
    message: { type: String, default: 'Hello' }
  },
  setup(props) {
    const doubled = computed(() => props.count * 2)
    const greeting = computed(() => `${props.message} World`)
    return { doubled, greeting }
  }
})
```

**Output:**
```typescript
<script setup lang="ts">
import { computed } from "vue";
type Props = {
  count: number;
  message?: string;
};
const { count, message = 'Hello' } = defineProps<Props>();

const doubled = computed(() => count * 2);
const greeting = computed(() => `${message} World`);
</script>
```

### useAttrs and useSlots Conversion
Automatically converts setup context parameters to Composition API equivalents:

**Input:**
```typescript
export default defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return { attrs, slots }
  }
})
```

**Output:**
```typescript
<script setup lang="ts">
import { useAttrs, useSlots } from "vue";
defineOptions({
  inheritAttrs: false
});
const attrs = useAttrs();
const slots = useSlots();
</script>
```

### defineOptions Support
Component options like `inheritAttrs`, `directives`, etc. are converted to `defineOptions()`:

- `inheritAttrs: false` → `defineOptions({ inheritAttrs: false })`
- Custom directives and other component-level options
- Automatically skips props, emits, setup, components (handled by other converters)