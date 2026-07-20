// 登録の整合。system.json・CONFIG・データモデルが食い違っていないかを見る。
import { assertInPage } from "../lib/harness.mjs";

export const title = "登録";

export async function run({ page, check }) {
  await check("documentTypes と dataModels が一致する", () =>
    assertInPage(page, () => {
      const report = [];
      for (const documentName of ["Actor", "Item", "ChatMessage"]) {
        const declared = (game.documentTypes[documentName] ?? []).filter((t) => t !== "base");
        const registered = Object.keys(CONFIG[documentName].dataModels ?? {});
        // system.json に無い種別を登録すると、作成できないのに型だけが増えて嘘になる
        const onlyRegistered = registered.filter((t) => !declared.includes(t));
        // 逆に宣言だけしてデータモデルが無いと、素の Document として作られてしまう
        const onlyDeclared = declared.filter((t) => !registered.includes(t));
        if (onlyRegistered.length > 0) {
          report.push(`${documentName}: 宣言が無いのに登録 → ${onlyRegistered.join(", ")}`);
        }
        if (onlyDeclared.length > 0) {
          report.push(`${documentName}: 登録が無いのに宣言 → ${onlyDeclared.join(", ")}`);
        }
      }
      return {
        ok: report.length === 0,
        detail:
          report.length === 0
            ? ["Actor", "Item", "ChatMessage"]
                .map((d) => `${d}:${Object.keys(CONFIG[d].dataModels ?? {}).join("/") || "なし"}`)
                .join(" ")
            : report.join(" / "),
      };
    }),
  );

  await check("trackableAttributes の参照先が実在する", () =>
    assertInPage(page, () => {
      const bad = [];
      for (const [type, groups] of Object.entries(CONFIG.Actor.trackableAttributes)) {
        const model = CONFIG.Actor.dataModels[type];
        if (!model) {
          bad.push(`${type}: データモデルが登録されていない`);
          continue;
        }
        for (const path of [...(groups.bar ?? []), ...(groups.value ?? [])]) {
          if (!model.schema.getField(path.split("."))) bad.push(`${type}.${path}`);
        }
      }
      return {
        ok: bad.length === 0,
        detail: bad.length === 0 ? "参照切れなし" : `スキーマに無い参照: ${bad.join(", ")}`,
      };
    }),
  );

  await check("シートが種別ごとに登録されている", () =>
    assertInPage(page, () => {
      const sheets = foundry.applications.apps.DocumentSheetConfig;
      const missing = [];
      for (const [documentName, types] of [
        ["Actor", game.documentTypes.Actor],
        ["Item", game.documentTypes.Item],
      ]) {
        for (const type of types.filter((t) => t !== "base")) {
          const registered = sheets.getSheetClassesForSubType(documentName, type);
          if (!registered?.defaultClasses || Object.keys(registered.defaultClasses).length === 0) {
            missing.push(`${documentName}.${type}`);
          }
        }
      }
      return {
        ok: missing.length === 0,
        detail: missing.length === 0 ? "すべて登録済み" : `シート未登録: ${missing.join(", ")}`,
      };
    }),
  );
}
