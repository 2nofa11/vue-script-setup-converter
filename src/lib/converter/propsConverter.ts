import {
  CallExpression,
  ObjectLiteralElementLike,
  ObjectLiteralExpression,
  PropertyAssignment,
  SyntaxKind,
  Node,
  ReturnStatement,
  MethodDeclaration,
  AsExpression,
  ArrowFunction,
} from "ts-morph";
import { getNodeByKind, getOptionsNode } from "../helpers/node";

export const convertProps = (node: CallExpression, lang: string = "js") => {
  const propsNode = getOptionsNode(node, "props");

  if (!propsNode) {
    return { code: "", isDestructuring: false, propNames: [] };
  }

  if (lang === "ts") {
    const result = convertToDestructuringDefineProps(propsNode);
    const propNames = extractPropNames(propsNode);
    return { code: result, isDestructuring: true, propNames };
  } else {
    const result = convertToDefineProps(propsNode);
    return { code: result, isDestructuring: false, propNames: [] };
  }
};

export const convertPropsToDestructuring = (
  node: CallExpression,
  lang: string = "ts"
) => {
  const propsNode = getOptionsNode(node, "props");

  if (!propsNode) {
    return "";
  }

  return convertToDestructuringDefineProps(propsNode);
};

const convertToDefineProps = (node: PropertyAssignment) => {
  const child = node.getInitializer();

  if (!child) {
    throw new Error("props is empty.");
  }

  if (Node.isObjectLiteralExpression(child)) {
    const properties = child.getProperties();
    const value = properties.map((x) => x.getText()).join(",");
    return `const props = defineProps({${value}});`;
  }

  return `const props = defineProps(${child.getFullText()});`;
};

// type-based declaration

type PropType =
  | {
      type: "array";
      propertyName: string;
    }
  | {
      type: "typeOnly";
      propertyName: string;
      typeValue: string;
    }
  | {
      type: "object";
      propertyName: string;
      typeValue?: string;
      required?: boolean;
      defaultValue?: string | boolean;
    };

const convertToDefinePropsForTs = (node: PropertyAssignment) => {
  const child = node.getInitializer();

  if (Node.isObjectLiteralExpression(child)) {
    const properties = child.getProperties();

    const arr: PropType[] = properties.map((x) => {
      if (!Node.isPropertyAssignment(x)) {
        throw new Error("property not found.");
      }

      const propObj = x.getInitializer();
      if (Node.isObjectLiteralExpression(propObj)) {
        return {
          ...convertPropsWithObject(propObj),
          propertyName: x.getName(),
        };
      }

      if (Node.isAsExpression(propObj)) {
        const typeValue = getPropTypeValue(propObj) ?? "";

        return {
          type: "typeOnly",
          typeValue,
          propertyName: x.getName(),
        };
      }

      const typeText = propObj?.getText() ?? "";

      return {
        type: "typeOnly",
        typeValue: typeMapping[typeText],
        propertyName: x.getName(),
      };
    });

    const props = convertToTypeDefineProps(arr);

    return props;
  }

  if (!Node.isArrayLiteralExpression(child)) {
    throw new Error("props not found.");
  }
  return `const defineProps(${child.getText()});`;
};

const convertToTypeDefineProps = (props: PropType[]) => {
  const members = props
    .map((x) => {
      if (x.type === "array") {
        return;
      }
      if (x.type === "object") {
        return `${x.propertyName}${
          isOptional(x.required, x.defaultValue) ? "?" : ""
        }: ${x.typeValue};`;
      }
      return `${x.propertyName}?: ${x.typeValue};`;
    })
    .filter(Boolean);

  const propType = `type Props = {${members.join("\n")}};`;

  const defineProps = `const props = defineProps<Props>();`;

  return propType + defineProps;
};

const convertPropsWithObject = (
  node: ObjectLiteralExpression
): {
  type: "object";
  typeValue: string;
  required?: boolean;
  defaultValue?: string | boolean;
} => {
  const properties = node.getProperties();

  const typeValue = getTypeValue(properties);

  const required = getPropsOption("required", properties);

  const defaultValue = getPropsOption("default", properties);

  return {
    type: "object",
    typeValue,
    required: required ? Boolean(required) : undefined,
    defaultValue,
  };
};

const getTypeValue = (properties: ObjectLiteralElementLike[]) => {
  const property = properties.find((x) => {
    if (!Node.isPropertyAssignment(x)) {
      return;
    }
    return x.getName() === "type";
  });

  const defaultValue = properties.find((x) => {
    if (Node.isMethodDeclaration(x) || Node.isPropertyAssignment(x)) {
      return x.getName() === "default";
    }
  });

  if (!property) {
    throw new Error("props property not found.");
  }

  if (!Node.isPropertyAssignment(property)) {
    throw new Error("props property not found.");
  }

  if (defaultValue) {
    if (Node.isMethodDeclaration(defaultValue)) {
      const inferredType = getPropTypeByDefault(defaultValue);
      if (inferredType) {
        return inferredType;
      }
    }

    if (Node.isPropertyAssignment(defaultValue)) {
      const initializer = defaultValue.getInitializer();

      if (Node.isArrowFunction(initializer)) {
        const inferredType = getPropTypeByArrowFunction(initializer);
        if (inferredType) {
          return inferredType;
        }
      }
    }
  }

  const initializer = property.getInitializer();

  if (!initializer) {
    throw new Error("props property not found.");
  }

  if (Node.isAsExpression(initializer)) {
    return getPropTypeValue(initializer) ?? "";
  }

  return typeMapping[initializer.getText()];
};

const getPropTypeValue = (node: AsExpression) => {
  const propType = node.getTypeNode();

  if (Node.isTypeReference(propType)) {
    const arg = propType.getTypeArguments()[0];

    return arg.getType().getText();
  }
};

/**
 * Extract the type from the default value.
 * (e.g.) default() { return { foo: "foo" } }
 */
const getPropTypeByDefault = (propsNode: MethodDeclaration) => {
  const body = propsNode.getBody();
  if (Node.isBlock(body)) {
    const statement = body.getStatement(
      (x) => x.getKind() === SyntaxKind.ReturnStatement
    ) as ReturnStatement;
    const expression = statement.getExpression();

    if (
      Node.isObjectLiteralExpression(expression) ||
      Node.isArrayLiteralExpression(expression)
    ) {
      return expression.getType().getText();
    }
  }
};

/**
 * Extract the type from the default value.
 * (e.g.) default: () => ({ foo: "foo" })
 */
const getPropTypeByArrowFunction = (node: ArrowFunction) => {
  const body = node.getBody();

  if (Node.isBlock(body)) {
    const statement = body.getStatements()[0];

    if (Node.isReturnStatement(statement)) {
      const expression = statement.getExpression();

      if (
        Node.isObjectLiteralExpression(expression) ||
        Node.isArrayLiteralExpression(expression)
      ) {
        return expression.getType().getText();
      }
    }
  }

  if (Node.isArrayLiteralExpression(body)) {
    return body.getType().getText();
  }

  if (Node.isParenthesizedExpression(body)) {
    return body.getExpression().getType().getText();
  }
};

const getPropsOption = (
  type: "required" | "default",
  properties: ObjectLiteralElementLike[]
) => {
  const property = properties.find((x) => {
    if (Node.isPropertyAssignment(x) || Node.isMethodDeclaration(x)) {
      return x.getName() === type;
    }
  });

  if (!property) {
    return;
  }

  if (Node.isMethodDeclaration(property)) {
    const body = property.getBody();
    if (Node.isBlock(body)) {
      const statement = body.getStatement(
        (x) => x.getKind() === SyntaxKind.ReturnStatement
      ) as ReturnStatement;
      const expression = statement.getExpression();

      if (
        Node.isObjectLiteralExpression(expression) ||
        Node.isArrayLiteralExpression(expression)
      ) {
        return `() => (${expression.getText()})`;
      }
    }
    return;
  }

  if (!Node.isPropertyAssignment(property)) {
    throw new Error("props property not found.");
  }

  const initializer = property.getInitializer();

  if (Node.isIdentifier(initializer)) {
    if (!initializer) {
      throw new Error("props property not found.");
    }
    return initializer.getText();
  } else {
    if (!initializer) {
      throw new Error("props property not found.");
    }

    if (Node.isArrowFunction(initializer)) {
      const returnStatement = getNodeByKind(
        initializer,
        SyntaxKind.ReturnStatement
      ) as ReturnStatement;

      if (!returnStatement) {
        // When there is no return statement (e.g., () => (value: string) => value.toUpperCase())
        // Get the arrow function body directly
        const body = initializer.getBody();
        if (Node.isParenthesizedExpression(body)) {
          return `() => (${body.getExpression().getText()})`;
        }
        if (Node.isArrowFunction(body)) {
          return `() => (${body.getText()})`;
        }
        return initializer.getText();
      }

      const expression = returnStatement.getExpression();
      if (
        Node.isObjectLiteralExpression(expression) ||
        Node.isArrayLiteralExpression(expression)
      ) {
        return `() => (${expression.getText()})`;
      }
    }

    if (
      isFalseKeyword(initializer.getKind()) ||
      isTrueKeyword(initializer.getKind())
    ) {
      return isTrueKeyword(initializer.getKind());
    }
    if (Node.isLiteralLike(initializer)) {
      return initializer.getText();
    }

    return initializer.getText();
  }
};

const isTrueKeyword = (kind: SyntaxKind) => {
  return kind === SyntaxKind.TrueKeyword;
};

const isFalseKeyword = (kind: number) => {
  return kind === SyntaxKind.FalseKeyword;
};

const isOptional = (required?: boolean, defaultValue?: string | boolean) => {
  return !required || defaultValue !== undefined;
};

const typeMapping: Record<string, string> = {
  String: "string",
  Number: "number",
  Boolean: "boolean",
  Object: "any",
  Function: "Function",
};

// Implementation of Destructuring Props conversion
const convertToDestructuringDefineProps = (
  node: PropertyAssignment
): string => {
  const child = node.getInitializer();

  if (!child) {
    throw new Error("props is empty.");
  }

  if (!Node.isObjectLiteralExpression(child)) {
    throw new Error("props not found.");
  }

  const properties = child.getProperties();

  const props: PropType[] = properties.map((x) => {
    if (!Node.isPropertyAssignment(x)) {
      throw new Error("property not found.");
    }

    const propObj = x.getInitializer();
    if (Node.isObjectLiteralExpression(propObj)) {
      return {
        ...convertPropsWithObject(propObj),
        propertyName: x.getName(),
      };
    }

    if (Node.isAsExpression(propObj)) {
      const typeValue = getPropTypeValue(propObj) ?? "";
      return {
        type: "typeOnly",
        typeValue,
        propertyName: x.getName(),
      };
    }

    const typeText = propObj?.getText() ?? "";
    return {
      type: "typeOnly",
      typeValue: typeMapping[typeText],
      propertyName: x.getName(),
    };
  });

  // Generate type definition
  const members = props
    .map((x) => {
      if (x.type === "array") {
        return;
      }
      if (x.type === "object") {
        return `${x.propertyName}${
          isOptional(x.required, x.defaultValue) ? "?" : ""
        }: ${x.typeValue};`;
      }
      return `${x.propertyName}?: ${x.typeValue};`;
    })
    .filter(Boolean);

  const propType = `type Props = {${members.join("\n")}};`;

  // Generate destructuring
  const destructuringParams = props
    .map((x) => {
      if (x.type === "object" && x.defaultValue !== undefined) {
        const simplifiedDefault = simplifyDefaultValue(x.defaultValue);
        return `${x.propertyName} = ${simplifiedDefault}`;
      }
      return x.propertyName;
    })
    .join(", ");

  const destructuringDefineProps = `const { ${destructuringParams} } = defineProps<Props>();`;

  return propType + destructuringDefineProps;
};

// Function to simplify default values
const simplifyDefaultValue = (defaultValue: string | boolean): string => {
  if (typeof defaultValue === "boolean" || typeof defaultValue === "number") {
    return String(defaultValue);
  }

  if (typeof defaultValue === "string") {
    // Simplify the format from () => (object/array literal) to object/array literal
    // However, exclude cases like () => (arrow function)
    if (defaultValue.startsWith("() => (") && defaultValue.endsWith(")")) {
      const content = defaultValue.slice(7, -1);
      // If the content is an arrow function, return only the arrow function part without removing parentheses
      if (content.includes("=>")) {
        return content; // Return the arrow function within parentheses as is
      }
      // Remove parentheses for object or array literals
      return content;
    }
    // Simplify the format from () => expression (without parentheses)
    if (defaultValue.startsWith("() => ")) {
      return defaultValue.slice(6);
    }
    // Remove parentheses only for simple expressions surrounded by parentheses
    if (defaultValue.startsWith("(") && defaultValue.endsWith(")") && !defaultValue.includes("() =>")) {
      return defaultValue.slice(1, -1);
    }
  }

  return String(defaultValue);
};

// Function to extract prop names
const extractPropNames = (node: PropertyAssignment): string[] => {
  const child = node.getInitializer();

  if (!child || !Node.isObjectLiteralExpression(child)) {
    return [];
  }

  const properties = child.getProperties();
  return properties
    .filter((x): x is PropertyAssignment => Node.isPropertyAssignment(x))
    .map((x) => x.getName());
};
