import { CallExpression, Node } from "ts-morph";

export const convertDefineOptions = (node: CallExpression) => {
  const objectLiteral = node.getArguments()[0];

  if (!objectLiteral || !Node.isObjectLiteralExpression(objectLiteral)) {
    return "";
  }

  const properties = objectLiteral.getProperties();
  const optionsProperties = [];

  for (const prop of properties) {
    if (
      Node.isPropertyAssignment(prop) ||
      Node.isShorthandPropertyAssignment(prop)
    ) {
      const name = prop.getName();

      // Skip properties that are converted by other converters
      if (
        name === "props" ||
        name === "emits" ||
        name === "setup" ||
        name === "components" ||
        name === "name"
      ) {
        continue;
      }

      // Handle specific options that should be in defineOptions
      if (
        name === "inheritAttrs" ||
        name === "customRender" ||
        name === "directives"
      ) {
        optionsProperties.push(prop.getFullText().trim());
      }
    }
  }

  if (optionsProperties.length === 0) {
    return "";
  }

  return `defineOptions({\n  ${optionsProperties.join(",\n  ")}\n});`;
};
