import base from "@makvid/config/eslint";

// UI conventions (specs/002-saas-ui-revamp/contracts/ui-conventions.md): colors come from theme tokens and
// UI text from i18n. The shadcn primitives in components/ui are generated and exempt.
// Selectors avoid backslashes because esquery strips one escape level.
const COLOR_STYLE = {
  selector:
    "JSXAttribute[name.name='style'] Property[key.name=/^(color|background|backgroundColor|borderColor|fill|stroke)$/] > Literal[value=/^ *(#[0-9a-fA-F]+|(rgb|rgba|hsl|hsla|oklch)[(])/]",
  message: "Use a theme token (bg-background, text-foreground, ...), not a color literal.",
};
const COLOR_CLASS = {
  selector: "JSXAttribute[name.name='className'] > Literal[value=/(bg|text|border|ring|fill|stroke)-[[]#/]",
  message: "Use a theme token, not a hex color in className.",
};
const LITERAL_TEXT = {
  selector: "JSXElement > JSXText[value=/[A-Za-zÀ-ỹ]{2,}/]:not([value=/^[^A-Za-z]*(MakVid Studio|VI|EN)[^A-Za-z]*$/])",
  message: "Literal UI text: use useTranslations()/getTranslations().",
};

export default [
  ...base,
  {
    files: ["apps/web/src/**/*.tsx"],
    ignores: ["apps/web/src/components/ui/**"],
    rules: { "no-restricted-syntax": ["error", COLOR_STYLE, COLOR_CLASS] },
  },
  {
    // Literal UI text is an error everywhere except the generated shadcn primitives and the API reference page,
    // whose text comes from the OpenAPI file.
    files: ["apps/web/src/**/*.tsx"],
    ignores: ["apps/web/src/components/ui/**", "apps/web/src/app/[[]locale]/(marketing)/docs/**"],
    rules: { "no-restricted-syntax": ["error", COLOR_STYLE, COLOR_CLASS, LITERAL_TEXT] },
  },
];
