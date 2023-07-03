
const typescript = require("@rollup/plugin-typescript");
module.exports = {
    input: "./src/index.ts",
    output: [
        // 1. cjs -> commonjs
        // 2. esm
        {
            format: "cjs",
            file: "lib/guide-mini-vue.cjs.js",
        },
        {
            format: "es",
            file: "lib/guide-mini-vue.esm.js",
        },
    ],

    plugins: [typescript()],
};