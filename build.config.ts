import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  entries: ["src/index", "src/cli"],
  declaration: true,
  externals: ["typescript", "ts-morph"],
  clean: true,
  rollup: {
    emitCJS: true,
  },
});
