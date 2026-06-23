import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import path from 'path';
import externals from 'rollup-plugin-node-externals'

export default {
  input: 'src/server.ts',
  output: {
    file: 'dist/server.js',
    format: 'esm',
    sourcemap: false,
  },
  external: [/^[^./]/], // external import - any that does not start with . or /
  plugins: [
    externals(),
    nodeResolve(),
    typescript({
      tsconfig: './tsconfig.json',
      compilerOptions: {
        outDir: './dist',
        declaration: false,
      }
    }),
  ],
};
