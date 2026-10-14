// The specification defines a template as two files: styles/{key}.json for the
// map and styles/{key}.ui.json for the UI chrome on top. Those .ui.json files
// are the single source of truth for these tokens — they are copied into
// assets/templates by scripts/sync-assets.mjs. Do not restate the values here;
// two copies drift the moment one palette is retuned.
import miami6Ui from "../../assets/templates/miami-6.ui.json";
import ui1899 from "../../assets/templates/1899.ui.json";
import losAngelesUi from "../../assets/templates/los-angeles.ui.json";

export type TemplateKey = "miami-6" | "1899" | "los-angeles";

export interface Theme {
  background: string;
  surface: string;
  surfaceBorder: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentContrast: string;
  shadow: string;
}

export const THEMES: Record<TemplateKey, Theme> = {
  "miami-6": miami6Ui as Theme,
  "1899": ui1899 as Theme,
  "los-angeles": losAngelesUi as Theme,
};

export function getTheme(templateKey: TemplateKey): Theme {
  return THEMES[templateKey] ?? THEMES["miami-6"];
}
