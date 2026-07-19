// FoundryVTT本体（Node配布版zip）をfoundryvtt.comから取得し、型チェックに必要な
// client/ と common/ だけを foundry/ に展開する。CI用（ローカルはcreate-symlinks.mjsを使う）
// 認証フローはfelddy/foundryvtt-dockerと同じ:
//   トップページでCSRFトークン取得 → POST /auth/login/ → /releases/download でpresigned URL取得 → zip展開
// 必要な環境変数: FOUNDRY_USERNAME / FOUNDRY_PASSWORD / FOUNDRY_BUILD
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
    login_username: FOUNDRY_USERNAME,
    login_password: FOUNDRY_PASSWORD,
    login_redirect: "/",
    login: "",
  }).toString(),
  redirect: "manual",
});
storeCookies(login);
if (!jar.has("sessionid")) {
  console.error(
    "ログインに失敗しました（認証情報を確認。2FA有効のアカウントでは自動ログイン不可）",
  );
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

// 4. zipを取得し client/ と common/ だけ展開
const zipRes = await fetch(zipUrl, { headers: { "User-Agent": UA } });
if (!zipRes.ok) {
  console.error(`zipのダウンロードに失敗しました（status: ${zipRes.status}）`);
  process.exit(1);
}
const tmp = mkdtempSync(path.join(tmpdir(), "foundry-fetch-"));
const zipPath = path.join(tmp, `foundry-${FOUNDRY_BUILD}.zip`);
writeFileSync(zipPath, Buffer.from(await zipRes.arrayBuffer()));
const unzip = spawnSync("unzip", ["-q", "-o", zipPath, "client/*", "common/*", "-d", "foundry"], {
  stdio: "inherit",
});
rmSync(tmp, { recursive: true, force: true });
if (unzip.status !== 0) {
  console.error("zipの展開に失敗しました");
  process.exit(1);
}
console.log(`foundry/ にbuild ${FOUNDRY_BUILD}の client/ と common/ を展開しました`);
