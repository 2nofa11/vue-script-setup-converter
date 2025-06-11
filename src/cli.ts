#!/usr/bin/env node
import { convertSrc } from "./lib/convertSrc";
import { readFile, writeFile, stat, readdir } from "fs/promises";
import { parse } from "@vue/compiler-sfc";
import { consola } from "consola";
import { join, extname } from "path";

interface CliOptions {
  filePath?: string;
  write?: boolean;
  output?: string;
  help?: boolean;
  recursive?: boolean;
}

const parseArgs = (args: string[]): CliOptions => {
  const options: CliOptions = {};

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

const isDirectory = async (path: string): Promise<boolean> => {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
};

interface ProcessStats {
  success: number;
  errors: number;
  skipped: number;
}

const processDirectory = async (
  dirPath: string,
  options: CliOptions
): Promise<ProcessStats> => {
  const stats: ProcessStats = { success: 0, errors: 0, skipped: 0 };

  try {
    const entries = await readdir(dirPath);

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);

      if (await isDirectory(fullPath)) {
        if (options.recursive) {
          const subStats = await processDirectory(fullPath, options);
          stats.success += subStats.success;
          stats.errors += subStats.errors;
          stats.skipped += subStats.skipped;
        }
      } else if (extname(entry) === ".vue") {
        const result = await processFile(fullPath, options);
        if (result.success) {
          if (result.skipped) {
            stats.skipped++;
          } else {
            stats.success++;
          }
        } else {
          stats.errors++;
        }
      }
    }
  } catch (error: any) {
    consola.error(`Directory read error: ${dirPath}`, error.message);
    stats.errors++;
  }

  return stats;
};

interface ProcessResult {
  success: boolean;
  skipped: boolean;
  error?: string;
}

const processFile = async (
  filePath: string,
  options: CliOptions
): Promise<ProcessResult> => {
  try {
    const fileContent = await readFile(filePath, "utf-8");
    const convertedCode = convertSrc(fileContent);

    if (convertedCode === fileContent) {
      consola.info(`⏭️ Skip: ${filePath} (no changes needed)`);
      return { success: true, skipped: true };
    }

    if (options.write) {
      const updatedVueFile = replaceScriptSection(fileContent, convertedCode);
      await writeFile(filePath, updatedVueFile, "utf-8");
      consola.success(`File converted: ${filePath}`);
    } else {
      if (options.output) {
        const updatedVueFile = replaceScriptSection(fileContent, convertedCode);
        await writeFile(options.output, updatedVueFile, "utf-8");
        consola.success(`Conversion result saved: ${options.output}`);
      } else {
        console.log(convertedCode);
      }
    }

    return { success: true, skipped: false };
  } catch (error: any) {
    const errorMessage =
      error.code === "ENOENT"
        ? `File not found: ${filePath}`
        : `Error occurred during conversion: ${filePath} - ${error.message}`;

    consola.error(errorMessage);
    return { success: false, skipped: false, error: errorMessage };
  }
};

const showHelp = () => {
  consola.box(`
  ╭────────────────────────────────────────────────╮
  │        Vue Script Setup Converter              │
  │     Composition API → Script Setup Converter   │
  ╰────────────────────────────────────────────────╯
  `);

  consola.info("📋 Usage:");
  console.log("  npx vue-script-setup-converter <file-path> [options]\n");

  consola.info("⚙️  Options:");
  console.log(
    "  -w, --write      Overwrite original file with conversion result"
  );
  console.log("  -o, --output     Specify output file path");
  console.log("  -r, --recursive  Process directory recursively");
  console.log("  -h, --help       Show this help message\n");

  consola.info("💡 Examples:");
  console.log("  npx vue-script-setup-converter component.vue");
  console.log("  npx vue-script-setup-converter component.vue --write");
  console.log(
    "  npx vue-script-setup-converter component.vue --output converted.vue"
  );
  console.log("  npx vue-script-setup-converter ./src --recursive --write");
};

const displayProcessStats = (stats: ProcessStats): void => {
  const total = stats.success + stats.errors + stats.skipped;

  if (stats.success > 0) {
    consola.success(`✅ Success: ${stats.success} files converted`);
  }
  if (stats.errors > 0) {
    consola.error(`❌ Error: ${stats.errors} files failed to convert`);
  }
  if (stats.skipped > 0) {
    consola.info(`⏭️ Skip: ${stats.skipped} files (no changes needed)`);
  }

  consola.box(`📊 Total: ${total} files processed`);
};

const main = async () => {
  const options = parseArgs(process.argv);

  if (options.help) {
    showHelp();
    return;
  }

  if (!options.filePath) {
    consola.error("Error: Please specify a file path.");
    consola.info("Usage: npx vue-script-setup-converter <file-path>");
    consola.info("Details: npx vue-script-setup-converter --help");
    process.exit(1);
  }

  try {
    const targetPath = options.filePath!;

    if (await isDirectory(targetPath)) {
      if (!options.recursive) {
        consola.error(
          "Directory specified. Please use --recursive or -r option."
        );
        process.exit(1);
      }

      consola.start(`Processing directory: ${targetPath}`);
      const stats = await processDirectory(targetPath, options);

      if (stats.success + stats.errors + stats.skipped === 0) {
        consola.warn("No .vue files found to process.");
      } else {
        displayProcessStats(stats);
      }
    } else {
      const result = await processFile(targetPath, options);
      if (!result.success) {
        process.exit(1);
      }
    }
  } catch (error: any) {
    consola.error("Fatal error occurred:", error.message);
    process.exit(1);
  }
};

main();
