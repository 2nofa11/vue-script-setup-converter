import { getNodeByKind } from "../helpers/node";
import { CallExpression, SyntaxKind, MethodDeclaration, Node } from "ts-morph";
import { replaceEmit } from "./emitsConverter";

export const convertSetup = (node: CallExpression, propNames: string[] = []) => {
  const setupNode = getNodeByKind(
    node,
    SyntaxKind.MethodDeclaration
  ) as MethodDeclaration;

  if (!setupNode) {
    return "";
  }

  const contextName = setupNode.getParameters()[1]?.getName() ?? "";
  const setupParams = setupNode.getParameters();
  const contextParam = setupParams[1];

  let useAttrsDeclaration = "";
  let useSlotsDeclaration = "";

  if (contextParam && Node.isParameterDeclaration(contextParam)) {
    const destructuring = contextParam.getFirstChildByKind(
      SyntaxKind.ObjectBindingPattern
    );
    if (destructuring) {
      const elements = destructuring.getElements();
      const hasAttrs = elements.some((el) => el.getName() === "attrs");
      const hasSlots = elements.some((el) => el.getName() === "slots");

      if (hasAttrs) {
        useAttrsDeclaration = "const attrs = useAttrs();\n";
      }
      if (hasSlots) {
        useSlotsDeclaration = "const slots = useSlots();\n";
      }
    }
  }

  const blockNode = getNodeByKind(setupNode, SyntaxKind.Block);

  if (!blockNode) {
    return "";
  }

  const statements = blockNode
    .forEachChildAsArray()
    .filter((x) => x.getKind() !== SyntaxKind.ReturnStatement)
    .map((x) => {
      let code = x.getFullText();
      
      if (contextName) {
        code = replaceEmit(code, contextName);
      }
      
      // Replace props references (only if propNames is not empty)
      if (propNames.length > 0) {
        code = replacePropsReferences(code, propNames);
      }
      
      return code;
    })
    .join("");

  return useAttrsDeclaration + useSlotsDeclaration + statements;
};

// Function to replace props references
const replacePropsReferences = (code: string, propNames: string[]): string => {
  let result = code;
  
  // Replace props.propName with propName for each prop name
  propNames.forEach(propName => {
    const regex = new RegExp(`props\\.${propName}\\b`, 'g');
    result = result.replace(regex, propName);
  });
  
  return result;
};
