import { loader } from '@monaco-editor/react';

loader.config({
  paths: {
    vs: '/monaco-editor/min/vs'
  }
});

export { default } from '@monaco-editor/react';
