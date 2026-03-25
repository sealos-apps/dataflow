import { loader } from '@monaco-editor/react';

loader.config({
  paths: {
    vs: 'https://unpkg.com/monaco-editor@0.45.0/min/vs'
  }
});

export { default } from '@monaco-editor/react';
