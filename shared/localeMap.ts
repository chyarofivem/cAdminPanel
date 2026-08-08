//NOTE: Don't modify the structure of this file without updating the locale:check script.

//Statically requiring languages because of the builders
import lang_en from "@locale/en.json";
import lang_hr from "@locale/hr.json";

export type LocaleType = typeof lang_en;
export type LocaleMapType = {
    [key: string]: LocaleType;
}

const localeMap: LocaleMapType = {
    en: lang_en,
    hr: lang_hr,
};

export default localeMap;
