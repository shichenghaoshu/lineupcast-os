// @lineupcast/ai-script — template re-exports

export {
  ZH_TEMPLATES,
  getZhTemplate,
  type ZhScriptTemplateSet,
  type ScriptTemplateSection,
  type TemplateSourceAnnotation,
} from "./zh.js";

export {
  EN_TEMPLATES,
  getEnTemplate,
  EN_DISCLAIMER,
  type EnScriptTemplateSet,
  type EnScriptTemplateSection,
} from "./en.js";

export {
  getBilingualTemplate,
  renderSeparate,
  renderMixed,
  renderTeleprompterSeparate,
  renderTeleprompterMixed,
  BILINGUAL_DISCLAIMER,
  type BilingualTemplateSet,
  type BilingualTemplateSection,
} from "./bilingual.js";
