const fixFrom = () => ({
  postcssPlugin: "fix-from-for-tailwind",
  Once(root, { result }) {
    if (!result.opts.from) {
      const sourceFrom = root.source?.input?.from;
      if (sourceFrom) result.opts.from = sourceFrom;
    }
  },
});
fixFrom.postcss = true;

const config = {
  plugins: [fixFrom(), "@tailwindcss/postcss"],
};

export default config;
