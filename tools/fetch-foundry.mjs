// FoundryVTT本体（Node配布版zip）をfoundryvtt.comから取得し、型チェックに必要な
// client/ と common/ だけを foundry/ に展開する。CI用（ローカルはcreate-symlinks.mjsを使う）
// 認証フロー:
//   トップページでCSRFトークン取得 → POST /auth/login/ → /releases/download でpresigned URL取得 → zip展開
// フォームのフィールド名（username / password / next / login）は実サイトのログインフォームに合わせている
// 必要な環境変数: FOUNDRY_USERNAME / FOUNDRY_PASSWORD / FOUNDRY_BUILD
import { spawnSync } from "node:child_process";
import { lstatSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const BASE = "https://foundryvtt.com";
const UA = "emoklore-ci (https://github.com/ryotai-trpg/emoklore)";

const { FOUNDRY_USERNAME, FOUNDRY_PASSWORD, FOUNDRY_BUILD } = process.env;
if (!FOUNDRY_USERNAME || !FOUNDRY_PASSWORD || !FOUNDRY_BUILD) {
  console.error("FOUNDRY_USERNAME / FOUNDRY_PASSWORD / FOUNDRY_BUILD を設定してください");
  process.exit(1);
}

const jar = new Map();
const storeCookies = (res) => {
  for (const cookie of res.headers.getSetCookie()) {
    const [pair] = cookie.split(";");
    const eq = pair.indexOf("=");
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
  }
};
const cookieHeader = () => [...jar].map(([name, value]) => `${name}=${value}`).join("; ");

// 1. トップページからCSRFトークンを取得
const top = await fetch(BASE, { headers: { "User-Agent": UA } });
storeCookies(top);
const csrf = (await top.text()).match(/name="csrfmiddlewaretoken" value="([^"]+)"/)?.[1];
if (!csrf) {
  console.error("CSRFトークンを取得できませんでした");
  process.exit(1);
}

// 2. ログイン（成功するとsessionid cookieが返る）
const login = await fetch(`${BASE}/auth/login/`, {
  method: "POST",
  headers: {
    "User-Agent": UA,
    Referer: `${BASE}/`,
    Cookie: cookieHeader(),
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({
    csrfmiddlewaretoken: csrf,
    username: FOUNDRY_USERNAME,
    password: FOUNDRY_PASSWORD,
    next: "/",
    login: "",
  }).toString(),
  redirect: "manual",
});
storeCookies(login);
if (!jar.has("sessionid")) {
  // 失敗理由を応答ページから推定して出し分ける（値そのものはログに出さない）
  const page = (await login.text()).toLowerCase();
  let reason = `原因を特定できませんでした（status: ${login.status}）`;
  if (page.includes("username and password")) {
    reason =
      "ユーザー名またはパスワードが一致しません（secretsの値のタイポ・前後の空白や改行の混入を確認）";
  } else if (/two.?factor|verification code|authenticator/.test(page)) {
    reason =
      "2FAが有効なため自動ログインできません（CI用にはアプリケーションパスワード等が無いため2FA解除が必要）";
  } else if (login.status === 403) {
    reason = "アクセスが拒否されました（CSRF検証またはWAF）";
  }
  console.error(`ログインに失敗しました: ${reason}`);
  process.exit(1);
}

// 3. presigned URLを取得
const release = await fetch(
  `${BASE}/releases/download?build=${FOUNDRY_BUILD}&platform=node&response_type=json`,
  { headers: { "User-Agent": UA, Cookie: cookieHeader() }, redirect: "manual" },
);
let zipUrl = release.headers.get("location");
if (!zipUrl) {
  const body = await release.json().catch(() => null);
  zipUrl = body?.url;
}
if (!zipUrl) {
  console.error(`ダウンロードURLを取得できませんでした（status: ${release.status}）`);
  process.exit(1);
}

// 4. zipを取得し client/ と common/ だけ展開（展開先は FOUNDRY_OUT で変更可、既定 foundry/）
const outDir = process.env.FOUNDRY_OUT ?? "foundry";
for (const dir of ["client", "common"]) {
  try {
    if (lstatSync(path.join(outDir, dir)).isSymbolicLink()) {
      // ローカルでは foundry/ が本体インストールへのsymlinkのため、unzipで実インストールを
      // 上書きしないよう拒否する
      console.error(
        `${outDir}/${dir} がsymlinkです。ローカルで試す場合は FOUNDRY_OUT=/tmp/foundry-test などを指定してください`,
      );
      process.exit(1);
    }
  } catch {
    // 存在しなければ問題ない
  }
}
const zipRes = await fetch(zipUrl, { headers: { "User-Agent": UA } });
if (!zipRes.ok) {
  console.error(`zipのダウンロードに失敗しました（status: ${zipRes.status}）`);
  process.exit(1);
}
const tmp = mkdtempSync(path.join(tmpdir(), "foundry-fetch-"));
const zipPath = path.join(tmp, `foundry-${FOUNDRY_BUILD}.zip`);
writeFileSync(zipPath, Buffer.from(await zipRes.arrayBuffer()));
const unzip = spawnSync("unzip", ["-q", "-o", zipPath, "client/*", "common/*", "-d", outDir], {
  stdio: "inherit",
});
rmSync(tmp, { recursive: true, force: true });
if (unzip.status !== 0) {
  console.error("zipの展開に失敗しました");
  process.exit(1);
}
console.log(`${outDir}/ にbuild ${FOUNDRY_BUILD}の client/ と common/ を展開しました`);
