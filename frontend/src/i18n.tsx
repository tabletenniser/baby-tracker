import React, { createContext, useContext, useEffect, useState } from "react";

export type Lang = "en" | "zh";

const en: Record<string, string> = {
  "app.title": "Baby Tracker",
  "app.loading": "Loading…",
  "tab.timeline": "📅 Timeline",
  "tab.insights": "📊 Insights",
  "nav.prev": "Previous day",
  "nav.next": "Next day",
  "lang.toggle": "EN",

  "summary.title": "Totals",
  "summary.totalMilk": "🥛 Total milk",
  "summary.breast": "🤱 Breast",
  "summary.formula": "🍼 Formula",
  "summary.sleep": "😴 Sleep",
  "summary.pee": "💧 Pee",
  "summary.poop": "💩 Poop",
  "summary.supplements": "💊 Supplements",

  "timeline.today": "Today",
  "add.feeding": "🤱 Feeding",
  "add.sleep": "😴 Sleep",
  "add.elim": "💧 Pee/Poop",
  "add.supplement": "💊 Supplement",

  "item.breast": "Breast",
  "item.bottle": "Bottle",
  "item.sleep": "Sleep",
  "item.sleptUntil": "Slept until",
  "item.pee": "Pee",
  "item.poop": "Poop",
  "item.edit": "Edit",
  "item.total": "Total",
  "item.left": "L",
  "item.right": "R",
  "item.formula": "Formula",
  "item.breastMl": "Breast",
  "item.fromPrevNight": "from {t} prev night",
  "item.size": "Size",
  "item.watery": "Watery",
  "item.noActivity": "No activity recorded for this day yet.",

  "common.add": "Add",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.remove": "Remove",
  "common.confirmDelete": "Delete this entry?",

  "feeding.add": "Add feeding",
  "feeding.edit": "Edit feeding",
  "feeding.type": "Type",
  "feeding.breast": "Breast",
  "feeding.bottle": "Bottle",
  "feeding.time": "Time",
  "feeding.weight": "Weight (g)",
  "feeding.before": "before",
  "feeding.addWeight": "+ Add weight",
  "feeding.formulaMl": "Formula milk (ml)",
  "feeding.breastMl": "Breast milk (ml)",
  "feeding.left": "Left",
  "feeding.right": "Right",
  "feeding.na": "N/A",
  "feeding.needTime": "Please set a time.",
  "feeding.needWeights": "Add at least two weights to calculate the amount fed.",
  "feeding.side": "Side",
  "feeding.after": "after",

  "sleep.add": "Add sleep",
  "sleep.edit": "Edit sleep",
  "sleep.startEnd": "Start + End",
  "sleep.durationEnd": "Duration + End",
  "sleep.start": "Start",
  "sleep.end": "End",
  "sleep.duration": "Duration (h)",
  "sleep.preview": "Sleep {h}",

  "elim.add": "Add pee/poop",
  "elim.edit": "Edit pee/poop",
  "elim.pee": "Pee",
  "elim.poop": "Poop",
  "elim.time": "Time",
  "elim.size": "Size",
  "elim.watery": "Watery",
  "elim.formed": "Formed",
  "elim.middle": "Middle",
  "elim.wateryLevel": "Watery",

  "supp.add": "Add supplement",
  "supp.edit": "Edit supplement",
  "supp.time": "Time",
  "supp.name": "Supplement",
  "supp.choose": "Choose…",
  "supp.vitaminD": "Vitamin D",
  "supp.probiotic": "Probiotic",
  "supp.iron": "Iron",
  "supp.vitaminC": "Vitamin C",
  "supp.other": "Other",
  "supp.needName": "Please choose or enter a supplement.",
  "supp.customName": "Name",

  "profile.title": "Baby profile",
  "profile.name": "Name",
  "profile.birthday": "Birthday",
  "profile.sex": "Sex",
  "profile.girl": "♀ Girl",
  "profile.boy": "♂ Boy",
  "profile.dayStarts": "Day starts at",
  "profile.dayStartsHint": "When the day begins, for splitting sleep. Default 12:00 AM.",

  "setup.title": "Welcome 👋",
  "setup.subtitle": "Let's set up your baby's profile.",
  "setup.name": "Name",
  "setup.birthday": "Birthday",
  "setup.sex": "Sex",
  "setup.girl": "♀ Girl",
  "setup.boy": "♂ Boy",
  "setup.go": "Let's go",
  "setup.needBirthday": "Please pick a birthday.",

  "insights.range": "Range",
  "insights.d7": "7 days",
  "insights.d14": "14 days",
  "insights.d31": "31 days",
  "insights.custom": "Custom",
  "insights.from": "From",
  "insights.to": "To",
  "insights.milk": "🥛 Milk per day",
  "insights.breast": "Breast",
  "insights.formula": "Formula",
  "insights.sleep": "😴 Sleep per day",
  "insights.poop": "💩 Poop per day",
  "insights.bedtime": "🌙 Nighttime sleep",
  "insights.bedtimeText": "Usually falls asleep around {t}",
  "insights.bedtimeCount": "(avg of {n} night sleeps)",
  "insights.noBedtime": "No nighttime sleep in this range yet.",
  "insights.growth": "📈 Growth",
  "insights.latest": "Latest:",
  "insights.percentile": "about the {n}th percentile",
  "growth.p50": "50th",
  "growth.p1585": "15th / 85th",
  "growth.p397": "3rd / 97th",
  "growth.baby": "Baby",
  "growth.setSex": "Set the baby's sex in the profile (tap the age) to see the WHO growth chart.",
  "growth.noPoints": "No weight points yet — record a breast feeding with a “before” weight to add one.",
  "growth.months": "months",
  "growth.note": "WHO weight-for-age reference. Weight = the “before” weight from each breast feeding.",

  "trend.title": "🥛 Feeding trend",
  "trend.today": "Today",
  "trend.yesterday": "Yesterday",
  "trend.avg7": "7-day avg",
  "trend.avg14": "14-day avg",
  "trend.soFar": "so far",

  "cutoff.label": "Day starts",
  "cutoff.override": "This day only",
  "cutoff.clear": "Reset",
};

const zh: Record<string, string> = {
  "app.title": "宝宝记录",
  "app.loading": "加载中…",
  "tab.timeline": "📅 时间线",
  "tab.insights": "📊 统计",
  "nav.prev": "前一天",
  "nav.next": "后一天",
  "lang.toggle": "中文",

  "summary.title": "今日汇总",
  "summary.totalMilk": "🥛 总奶量",
  "summary.breast": "🤱 母乳",
  "summary.formula": "🍼 配方奶",
  "summary.sleep": "😴 睡眠",
  "summary.pee": "💧 小便",
  "summary.poop": "💩 大便",
  "summary.supplements": "💊 补充剂",

  "timeline.today": "今天",
  "add.feeding": "🤱 喂奶",
  "add.sleep": "😴 睡眠",
  "add.elim": "💧 大小便",
  "add.supplement": "💊 补充剂",

  "item.breast": "母乳",
  "item.bottle": "奶瓶",
  "item.sleep": "睡眠",
  "item.sleptUntil": "睡到",
  "item.pee": "小便",
  "item.poop": "大便",
  "item.edit": "编辑",
  "item.total": "共",
  "item.left": "左",
  "item.right": "右",
  "item.formula": "配方奶",
  "item.breastMl": "母乳",
  "item.fromPrevNight": "从昨晚 {t} 起",
  "item.size": "大小",
  "item.watery": "稀稠",
  "item.noActivity": "这一天还没有记录。",

  "common.add": "添加",
  "common.save": "保存",
  "common.cancel": "取消",
  "common.close": "关闭",
  "common.remove": "删除",
  "common.confirmDelete": "删除这条记录？",

  "feeding.add": "添加喂奶",
  "feeding.edit": "编辑喂奶",
  "feeding.type": "类型",
  "feeding.breast": "母乳",
  "feeding.bottle": "奶瓶",
  "feeding.time": "时间",
  "feeding.weight": "体重（克）",
  "feeding.before": "喂奶前",
  "feeding.addWeight": "+ 添加体重",
  "feeding.formulaMl": "配方奶（毫升）",
  "feeding.breastMl": "母乳（毫升）",
  "feeding.left": "左",
  "feeding.right": "右",
  "feeding.na": "无",
  "feeding.needTime": "请设置时间。",
  "feeding.needWeights": "请添加至少两个体重来计算奶量。",
  "feeding.side": "侧",
  "feeding.after": "喂奶后",

  "sleep.add": "添加睡眠",
  "sleep.edit": "编辑睡眠",
  "sleep.startEnd": "开始+结束",
  "sleep.durationEnd": "时长+结束",
  "sleep.start": "开始",
  "sleep.end": "结束",
  "sleep.duration": "时长（小时）",
  "sleep.preview": "睡眠 {h}",

  "elim.add": "添加大小便",
  "elim.edit": "编辑大小便",
  "elim.pee": "小便",
  "elim.poop": "大便",
  "elim.time": "时间",
  "elim.size": "大小",
  "elim.watery": "稀稠",
  "elim.formed": "成形",
  "elim.middle": "中等",
  "elim.wateryLevel": "稀",

  "supp.add": "添加补充剂",
  "supp.edit": "编辑补充剂",
  "supp.time": "时间",
  "supp.name": "补充剂",
  "supp.choose": "选择…",
  "supp.vitaminD": "维生素D",
  "supp.probiotic": "益生菌",
  "supp.iron": "铁",
  "supp.vitaminC": "维生素C",
  "supp.other": "其他",
  "supp.needName": "请选择或输入补充剂。",
  "supp.customName": "名称",

  "profile.title": "宝宝资料",
  "profile.name": "名字",
  "profile.birthday": "生日",
  "profile.sex": "性别",
  "profile.girl": "♀ 女",
  "profile.boy": "♂ 男",
  "profile.dayStarts": "一天从几点开始",
  "profile.dayStartsHint": "用于拆分跨夜睡眠。默认凌晨 12:00。",

  "setup.title": "欢迎 👋",
  "setup.subtitle": "我们来设置宝宝资料。",
  "setup.name": "名字",
  "setup.birthday": "生日",
  "setup.sex": "性别",
  "setup.girl": "♀ 女",
  "setup.boy": "♂ 男",
  "setup.go": "开始",
  "setup.needBirthday": "请选择生日。",

  "insights.range": "范围",
  "insights.d7": "7 天",
  "insights.d14": "14 天",
  "insights.d31": "31 天",
  "insights.custom": "自定义",
  "insights.from": "从",
  "insights.to": "到",
  "insights.milk": "🥛 每日奶量",
  "insights.breast": "母乳",
  "insights.formula": "配方奶",
  "insights.sleep": "😴 每日睡眠",
  "insights.poop": "💩 每日大便",
  "insights.bedtime": "🌙 夜间睡眠",
  "insights.bedtimeText": "通常在 {t} 左右入睡",
  "insights.bedtimeCount": "（{n} 次夜眠平均）",
  "insights.noBedtime": "这个范围还没有夜间睡眠记录。",
  "insights.growth": "📈 成长",
  "insights.latest": "最新：",
  "insights.percentile": "约 {n} 百分位",
  "growth.p50": "50百分位",
  "growth.p1585": "15 / 85百分位",
  "growth.p397": "3 / 97百分位",
  "growth.baby": "宝宝",
  "growth.setSex": "在资料中设置宝宝性别（点击年龄）以查看 WHO 成长曲线。",
  "growth.noPoints": "还没有体重数据——记录一次带“喂奶前”体重的母乳喂养即可添加。",
  "growth.months": "个月",
  "growth.note": "WHO 年龄-体重参考曲线。体重 = 每次母乳喂养的“喂奶前”体重。",

  "trend.title": "🥛 喂奶趋势",
  "trend.today": "今天",
  "trend.yesterday": "昨天",
  "trend.avg7": "7天平均",
  "trend.avg14": "14天平均",
  "trend.soFar": "目前",

  "cutoff.label": "一天从",
  "cutoff.override": "仅今天",
  "cutoff.clear": "重置",
};

const translations: Record<Lang, Record<string, string>> = { en, zh };

/** Map a stored (canonical) supplement name to its localized label. */
export function supplementLabel(name: string, t: (k: string) => string): string {
  switch (name) {
    case "Vitamin D":
      return t("supp.vitaminD");
    case "Probiotic":
      return t("supp.probiotic");
    case "Iron":
      return t("supp.iron");
    case "Vitamin C":
      return t("supp.vitaminC");
    case "Other":
      return t("supp.other");
    default:
      return name;
  }
}

export const SUPPLEMENT_CHOICES = ["Vitamin D", "Probiotic", "Iron", "Vitamin C", "Other"];

interface LangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LangContext = createContext<LangContextType>({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
});

export function useLang() {
  return useContext(LangContext);
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      return localStorage.getItem("baby-lang") === "zh" ? "zh" : "en";
    } catch {
      return "en";
    }
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("baby-lang", l);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key: string, vars?: Record<string, string | number>) => {
    let s = translations[lang][key] ?? translations.en[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.split(`{${k}}`).join(String(v));
      }
    }
    return s;
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>
  );
}
