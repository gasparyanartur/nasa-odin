# three.js, vendored

- Version: r187 (npm 0.187.0)
- Source: https://registry.npmjs.org/three/-/three-0.187.0.tgz
- Registry integrity (sha512, checked against the downloaded tarball before unpacking): `sha512-Qiu7R+Cmh8CstZsY1uJOSWnVlfo7ZtNLV7mF8Jltk3LB3AtDu9cRZlcnRKkAk8Y4z6KKw35z7Y7Urd7jWY8etA==`
- Licence: MIT, see `LICENSE`
- The tarball ships no minified build. These files are copied unchanged from the package; nothing was edited and nothing from the tarball was run.
- The package layout is kept, so the relative imports inside the files work without edits.
- The addons import `three` by bare name. The app maps it with an import map: `"three": "./vendor/three/build/three.module.js"`.

SHA-256 of each vendored file (path relative to this folder):

| File | SHA-256 |
|---|---|
| `LICENSE` | `8b378ebe60e2fe500158cb0ac71cb5e8b7d92953c2abcc63a0eb90499653b5bc` |
| `build/three.core.js` | `613e370f76638fdef83926642bf256dc9615684922de1ce1f63a8583e5d78578` |
| `build/three.module.js` | `104f56145899722094556490d787aae0617cc2fc3382f31df02d724ea1aee341` |
| `examples/jsm/controls/MapControls.js` | `5a686152c498914389d1503b60121f484d06f15cb4f7405c15fb6b8ddcc1bdb6` |
| `examples/jsm/controls/OrbitControls.js` | `e7fca2fe9e7670a828af9b28084669a5909445b7f36f1f26cee9bf8f2961c32c` |
