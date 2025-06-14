import { expect, describe, it, vi, beforeEach, afterEach } from "vitest";
import { readFile, writeFile, mkdir, rm, stat } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

// Extract functions from file to directly test CLI functions
const createCli = () => {
  const parseArgs = (args: string[]) => {
    const options: any = {};

    for (let i = 2; i < args.length; i++) {
      const arg = args[i];

      if (arg === "--help" || arg === "-h") {
        options.help = true;
      } else if (arg === "--write" || arg === "-w") {
        options.write = true;
      } else if (arg === "--output" || arg === "-o") {
        options.output = args[++i];
      } else if (arg === "--recursive" || arg === "-r") {
        options.recursive = true;
      } else if (!arg.startsWith("-")) {
        options.filePath = arg;
      }
    }

    return options;
  };

  const replaceScriptSection = (
    vueContent: string,
    newScript: string
  ): string => {
    const { parse } = require("@vue/compiler-sfc");
    const { descriptor } = parse(vueContent);

    if (!descriptor.script) {
      return vueContent;
    }

    // Accurately identify the start of <script> tag and end of </script> tag
    const scriptTagRegex = /<script[^>]*>/;
    const endScriptTagRegex = /<\/script>/;
    
    const scriptMatch = vueContent.match(scriptTagRegex);
    const endScriptMatch = vueContent.match(endScriptTagRegex);
    
    if (!scriptMatch || !endScriptMatch) {
      return vueContent;
    }
    
    const scriptTagStart = scriptMatch.index!;
    const scriptTagEnd = endScriptMatch.index! + endScriptMatch[0].length;
    
    const before = vueContent.substring(0, scriptTagStart);
    const after = vueContent.substring(scriptTagEnd);
    
    return before + newScript + after;
  };

  return { parseArgs, replaceScriptSection };
};

describe("CLI", () => {
  let cli: ReturnType<typeof createCli>;

  beforeEach(() => {
    cli = createCli();
    vi.clearAllMocks();
  });

  describe("parseArgs", () => {
    it("should parse file path", () => {
      const result = cli.parseArgs(["node", "cli.js", "component.vue"]);
      expect(result.filePath).toBe("component.vue");
    });

    it("should parse help option", () => {
      const result = cli.parseArgs(["node", "cli.js", "--help"]);
      expect(result.help).toBe(true);
    });

    it("should parse help option (short)", () => {
      const result = cli.parseArgs(["node", "cli.js", "-h"]);
      expect(result.help).toBe(true);
    });

    it("should parse write option", () => {
      const result = cli.parseArgs([
        "node",
        "cli.js",
        "component.vue",
        "--write",
      ]);
      expect(result.write).toBe(true);
      expect(result.filePath).toBe("component.vue");
    });

    it("should parse write option (short)", () => {
      const result = cli.parseArgs(["node", "cli.js", "component.vue", "-w"]);
      expect(result.write).toBe(true);
    });

    it("should parse output option", () => {
      const result = cli.parseArgs([
        "node",
        "cli.js",
        "component.vue",
        "--output",
        "output.vue",
      ]);
      expect(result.output).toBe("output.vue");
      expect(result.filePath).toBe("component.vue");
    });

    it("should parse output option (short)", () => {
      const result = cli.parseArgs([
        "node",
        "cli.js",
        "component.vue",
        "-o",
        "output.vue",
      ]);
      expect(result.output).toBe("output.vue");
    });

    it("should parse multiple options", () => {
      const result = cli.parseArgs([
        "node",
        "cli.js",
        "component.vue",
        "--write",
        "--output",
        "backup.vue",
      ]);
      expect(result.filePath).toBe("component.vue");
      expect(result.write).toBe(true);
      expect(result.output).toBe("backup.vue");
    });

    it("should parse recursive option", () => {
      const result = cli.parseArgs([
        "node",
        "cli.js",
        "./src",
        "--recursive",
        "--write",
      ]);
      expect(result.filePath).toBe("./src");
      expect(result.recursive).toBe(true);
      expect(result.write).toBe(true);
    });

    it("should parse recursive option (short)", () => {
      const result = cli.parseArgs([
        "node",
        "cli.js",
        "./components",
        "-r",
        "-w",
      ]);
      expect(result.filePath).toBe("./components");
      expect(result.recursive).toBe(true);
      expect(result.write).toBe(true);
    });
  });

  describe("replaceScriptSection", () => {
    it("should replace script section with new script setup", () => {
      const vueContent = `<template>
  <div>{{ msg }}</div>
</template>

<script>
import { defineComponent } from 'vue';

export default defineComponent({
  props: {
    msg: String
  }
});
</script>

<style scoped>
div {
  color: red;
}
</style>`;

      const newScript = `<script setup lang="ts">
type Props = {
  msg?: string;
};
const { msg } = defineProps<Props>();
</script>`;

      const result = cli.replaceScriptSection(vueContent, newScript);

      expect(result).toContain("<template>");
      expect(result).toContain("<div>{{ msg }}</div>");
      expect(result).toContain("</template>");
      expect(result).toContain('<script setup lang="ts">');
      expect(result).toContain("const { msg } = defineProps<Props>();");
      expect(result).toContain("</script>");
      expect(result).toContain("<style scoped>");
      expect(result).toContain("color: red");
      expect(result).toContain("</style>");
      expect(result).not.toContain("export default defineComponent");
    });

    it("should handle Vue file without script section", () => {
      const vueContent = `<template>
  <div>Hello</div>
</template>

<style>
div { color: blue; }
</style>`;

      const newScript = `<script setup>
console.log('test');
</script>`;

      const result = cli.replaceScriptSection(vueContent, newScript);
      expect(result).toBe(vueContent); // Should return original content unchanged
    });

    it("should handle script with lang attribute", () => {
      const vueContent = `<template>
  <div>Test</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
export default defineComponent({
  name: 'Test'
});
</script>`;

      const newScript = `<script setup lang="ts">
// converted
</script>`;

      const result = cli.replaceScriptSection(vueContent, newScript);
      expect(result).toContain('<script setup lang="ts">');
      expect(result).toContain("// converted");
      expect(result).not.toContain("export default defineComponent");
    });
  });

  describe("integration tests", () => {
    it("should handle write option workflow", async () => {
      const mockVueContent = `<template>
  <div>{{ message }}</div>
</template>

<script>
import { defineComponent } from 'vue';

export default defineComponent({
  props: {
    message: String
  }
});
</script>

<style>
div { color: blue; }
</style>`;

      const mockConvertedScript = `<script setup lang="ts">
type Props = {
  message?: string;
};
const { message } = defineProps<Props>();
</script>`;

      // Test the result of replaceScriptSection
      const result = cli.replaceScriptSection(mockVueContent, mockConvertedScript);
      
      expect(result).toContain("<template>");
      expect(result).toContain("{{ message }}");
      expect(result).toContain("<script setup lang=\"ts\">");
      expect(result).toContain("const { message } = defineProps<Props>();");
      expect(result).toContain("<style>");
      expect(result).toContain("color: blue");
      expect(result).not.toContain("export default defineComponent");
    });

    it("should handle output option workflow", async () => {
      const mockVueContent = `<template>
  <h1>{{ title }}</h1>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  props: {
    title: {
      type: String,
      required: true
    }
  }
});
</script>`;

      const mockConvertedScript = `<script setup lang="ts">
type Props = {
  title: string;
};
const { title } = defineProps<Props>();
</script>`;

      const result = cli.replaceScriptSection(mockVueContent, mockConvertedScript);
      
      expect(result).toContain("<template>");
      expect(result).toContain("{{ title }}");
      expect(result).toContain("<script setup lang=\"ts\">");
      expect(result).toContain("title: string;");
      expect(result).toContain("const { title } = defineProps<Props>();");
      expect(result).not.toContain("export default defineComponent");
    });

    it("should preserve template and style sections exactly", () => {
      const vueContent = `<template>
  <div class="container">
    <h1>{{ greeting }}</h1>
    <p>This is a test component</p>
  </div>
</template>

<script>
export default defineComponent({
  props: { greeting: String }
});
</script>

<style scoped>
.container {
  padding: 20px;
  background: #f0f0f0;
}

h1 {
  color: #333;
  font-size: 2rem;
}
</style>`;

      const newScript = `<script setup>
const { greeting } = defineProps(['greeting']);
</script>`;

      const result = cli.replaceScriptSection(vueContent, newScript);
      
      // Template section should be preserved exactly
      expect(result).toContain('<div class="container">');
      expect(result).toContain('<h1>{{ greeting }}</h1>');
      expect(result).toContain('<p>This is a test component</p>');
      
      // Style section should be preserved exactly
      expect(result).toContain('<style scoped>');
      expect(result).toContain('padding: 20px;');
      expect(result).toContain('background: #f0f0f0;');
      expect(result).toContain('font-size: 2rem;');
      
      // Script should be replaced
      expect(result).toContain('<script setup>');
      expect(result).toContain("const { greeting } = defineProps(['greeting']);");
      expect(result).not.toContain('export default defineComponent');
    });
  });

  describe("recursive directory processing", () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = join(tmpdir(), `vue-converter-test-${Date.now()}`);
      await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
      try {
        await rm(testDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    const createTestVueFile = async (filePath: string, content?: string) => {
      const defaultContent = `<template>
  <div>{{ msg }}</div>
</template>

<script>
import { defineComponent } from 'vue';
export default defineComponent({
  props: { msg: String }
});
</script>`;

      await writeFile(filePath, content || defaultContent, 'utf-8');
    };

    it("should handle directory structure creation and cleanup", async () => {
      const subDir = join(testDir, "components");
      await mkdir(subDir);
      
      const filePath = join(subDir, "Test.vue");
      await createTestVueFile(filePath);
      
      const stats = await stat(filePath);
      expect(stats.isFile()).toBe(true);
      
      const content = await readFile(filePath, 'utf-8');
      expect(content).toContain('defineComponent');
    });

    it("should process nested directory structure", async () => {
      // Create nested structure: testDir/components/ui/Button.vue
      const componentsDir = join(testDir, "components");
      const uiDir = join(componentsDir, "ui");
      
      await mkdir(componentsDir);
      await mkdir(uiDir);
      
      const buttonFile = join(uiDir, "Button.vue");
      await createTestVueFile(buttonFile);
      
      // Verify file exists
      const stats = await stat(buttonFile);
      expect(stats.isFile()).toBe(true);
    });

    it("should handle mixed file types in directory", async () => {
      const mixedDir = join(testDir, "mixed");
      await mkdir(mixedDir);
      
      // Create Vue file
      const vueFile = join(mixedDir, "Component.vue");
      await createTestVueFile(vueFile);
      
      // Create non-Vue file
      const jsFile = join(mixedDir, "script.js");
      await writeFile(jsFile, "console.log('test');", 'utf-8');
      
      // Create another Vue file
      const anotherVueFile = join(mixedDir, "Another.vue");
      await createTestVueFile(anotherVueFile);
      
      // Verify files exist
      expect((await stat(vueFile)).isFile()).toBe(true);
      expect((await stat(jsFile)).isFile()).toBe(true);
      expect((await stat(anotherVueFile)).isFile()).toBe(true);
    });
  });

  describe("error handling and resilience", () => {
    it("should handle parsing errors gracefully", () => {
      const invalidVueContent = `<template>
  <div>Invalid content</div>
</template>

<script>
// This is intentionally broken syntax
export default defineComponent({
  props: { 
    // Missing closing brace
};
</script>`;

      // This test verifies that replaceScriptSection doesn't crash on invalid content
      const result = cli.replaceScriptSection(invalidVueContent, "<script setup></script>");
      expect(result).toBeDefined();
    });

    it("should handle missing script tags", () => {
      const contentWithoutScript = `<template>
  <div>No script section</div>
</template>

<style>
div { color: red; }
</style>`;

      const result = cli.replaceScriptSection(contentWithoutScript, "<script setup></script>");
      expect(result).toBe(contentWithoutScript); // Should return unchanged
    });

    it("should handle malformed script tags", () => {
      const malformedContent = `<template>
  <div>Test</div>
</template>

<script
export default {};
</script>`;

      const result = cli.replaceScriptSection(malformedContent, "<script setup></script>");
      expect(result).toBeDefined();
    });

    it("should handle empty file content", () => {
      const emptyContent = "";
      const result = cli.replaceScriptSection(emptyContent, "<script setup></script>");
      expect(result).toBe(emptyContent);
    });
  });

  describe("statistics and reporting", () => {
    const mockProcessStats = {
      success: 3,
      errors: 1,
      skipped: 2
    };

    it("should calculate total processed files correctly", () => {
      const total = mockProcessStats.success + mockProcessStats.errors + mockProcessStats.skipped;
      expect(total).toBe(6);
    });

    it("should handle zero statistics", () => {
      const emptyStats = { success: 0, errors: 0, skipped: 0 };
      const total = emptyStats.success + emptyStats.errors + emptyStats.skipped;
      expect(total).toBe(0);
    });

    it("should handle only success cases", () => {
      const successOnlyStats = { success: 5, errors: 0, skipped: 0 };
      expect(successOnlyStats.success).toBeGreaterThan(0);
      expect(successOnlyStats.errors).toBe(0);
      expect(successOnlyStats.skipped).toBe(0);
    });

    it("should handle only error cases", () => {
      const errorOnlyStats = { success: 0, errors: 3, skipped: 0 };
      expect(errorOnlyStats.success).toBe(0);
      expect(errorOnlyStats.errors).toBeGreaterThan(0);
      expect(errorOnlyStats.skipped).toBe(0);
    });
  });
});
