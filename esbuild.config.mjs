import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";

const banner = `/* quick-add-button - generated bundle. Do not edit directly. */`;

const prod = process.argv[2] === "production";

// 개발 중에는 볼트의 플러그인 폴더로 바로 빌드해 넣을 수 있다.
//   OBSIDIAN_PLUGIN_DIR=C:/obsidian/ob_Moon/.obsidian/plugins/quick-add-button npm run dev
// 이것은 BRAT 산출물을 "손으로 고치는" 것이 아니라 동일 파이프라인으로 재생성하는 것이며,
// 소스의 유일한 원본은 항상 이 저장소다.
const devOut = process.env.OBSIDIAN_PLUGIN_DIR;

const ctx = await esbuild.context({
  banner: { js: banner },
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: !prod && devOut ? `${devOut}/main.js` : "main.js",
  minify: prod,
});

if (prod) {
  await ctx.rebuild();
  process.exit(0);
} else {
  await ctx.watch();
}
