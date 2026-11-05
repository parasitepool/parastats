'use client';

import { useState } from 'react';

const JS_TOKEN = /(\/\/[^\n]*|`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|\b(?:const|await|if|throw|new|null)\b|\b\d+(?:\.\d+)?(?:e\d+)?\b)/g;
const JSON_TOKEN = /("(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g;
const SHELL_TOKEN = /('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|https?:\/\/[^\s'"\\]+|--?[a-zA-Z-]+|\bcurl\b)/g;
type CodeLanguage = 'javascript' | 'json' | 'shell';

function highlightJavaScript(code: string) {
  return code.split(JS_TOKEN).map((token, index) => {
    let color: string | null = null;
    if (token.startsWith('//')) color = 'text-foreground italic';
    else if (token.startsWith("'") || token.startsWith('`')) color = 'text-green-400';
    else if (/^(const|await|if|throw|new|null)$/.test(token)) color = 'text-purple-400';
    else if (/^\d/.test(token)) color = 'text-amber-400';
    return color ? <span key={index} className={color}>{token}</span> : token;
  });
}

function highlightJson(code: string) {
  return code.split(JSON_TOKEN).map((token, index) => {
    let color: string | null = null;
    if (token.startsWith('"')) color = token.trimEnd().endsWith(':') ? 'text-sky-400' : 'text-green-400';
    else if (token === 'true' || token === 'false' || token === 'null') color = 'text-purple-400';
    else if (/^-?\d/.test(token)) color = 'text-amber-400';
    return color ? <span key={index} className={color}>{token}</span> : token;
  });
}

function highlightShell(code: string) {
  return code.split(SHELL_TOKEN).map((token, index) => {
    let color: string | null = null;
    if (token.startsWith('"') || token.startsWith("'") || token.startsWith('http')) color = 'text-green-400';
    else if (token === 'curl') color = 'text-purple-400';
    else if (token.startsWith('-')) color = 'text-sky-400';
    return color ? <span key={index} className={color}>{token}</span> : token;
  });
}

function highlightCode(code: string, language?: CodeLanguage) {
  if (language === 'javascript') return highlightJavaScript(code);
  if (language === 'json') return highlightJson(code);
  if (language === 'shell') return highlightShell(code);
  return code;
}

export default function CodeBlock({ code, language }: { code: string; language?: CodeLanguage }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="relative group">
      <pre className="bg-background border border-border p-3 pr-12 font-mono text-xs sm:text-sm overflow-x-auto whitespace-pre">
        <code>{highlightCode(code, language)}</code>
      </pre>
      <button
        onClick={copy}
        aria-label="Copy to clipboard"
        className="absolute top-2 right-2 px-2 py-1 text-xs border border-border text-foreground hover:text-foreground bg-secondary opacity-0 group-hover:opacity-100 focus:opacity-100 max-md:opacity-100 transition-opacity"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
