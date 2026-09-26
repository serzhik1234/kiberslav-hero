#!/bin/bash
# Собирает dist/index.html из частей в src/ и проверяет синтаксис (нужен Node.js)
set -e
cd "$(dirname "$0")"
{ cat src/head.html; cat src/body.html; echo "<script>"; cat src/world1.js src/world2.js src/world2b.js src/world3.js src/ui.js; echo "</script>"; echo "</body>"; echo "</html>"; } > dist/index.html
node -e "
const s=require('fs').readFileSync('dist/index.html','utf8');
const a=s.indexOf('/*WORLD-BEGIN*/'), b=s.indexOf('/*WORLD-END*/');
new Function('THREE','hooks', s.slice(a,b)+';return createWorld;');
[...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(m=>new Function(m[1]));
console.log('dist/index.html ok,', s.length, 'bytes');
"
