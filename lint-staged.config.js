export default {
  // eslint only the staged JS/TS files.
  '*.{js,jsx,ts,tsx,mjs,cjs}': 'eslint',
  // tsc can't scope to files, so run a full project typecheck (ignore the file
  // args lint-staged passes) whenever a TS file is staged.
  '*.{ts,tsx}': () => 'tsc -b',
}
