#!/usr/bin/env bash
# Validate .evidence/data.js (or example/data.js with --example). Read-only.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
if [ "${1:-}" = "--example" ]; then data="$here/example/data.js"; base="$here/example"
else data="${EVIDENCE_DIR:-$root/.evidence}/data.js"; base="$(dirname "$data")"; fi
command -v node >/dev/null || { echo "node not found" >&2; exit 2; }
[ -f "$data" ] || { echo "ERROR: $data not found. See scripts/qa/evidence/README.md" >&2; exit 1; }
exec node - "$data" "$base" <<'JS'
const fs=require('fs'),path=require('path'),vm=require('vm');
const [data,base]=process.argv.slice(2);
const errs=[],warns=[];
const win={};
try{vm.runInNewContext(fs.readFileSync(data,'utf8'),{window:win},{timeout:2000});}
catch(e){console.error('ERROR: data.js failed to load: '+e.message);process.exit(1);}
const L=win.EVIDENCE;
if(!Array.isArray(L)){console.error('ERROR: window.EVIDENCE is not an array');process.exit(1);}
const KIND=['info','unexpected'],ST=['open','seen','decided','fixed'],MT=['image','video'];
const isS=v=>typeof v==='string'&&v.trim()!=='';
const safe=p=>typeof p==='string'&&/^[A-Za-z0-9._\- \/]+$/.test(p)&&!p.startsWith('/')&&!p.includes('//')&&p.split('/').every(s=>s!==''&&s!=='.'&&s!=='..');
const seen=new Set(),nums=[];
L.forEach((r,i)=>{
 const w='record #'+(i+1)+(r&&r.id?' ('+r.id+')':'');
 const e=m=>errs.push(w+': '+m);
 if(!r||typeof r!=='object'||Array.isArray(r))return e('not an object');
 if(!isS(r.id)||!/^EV-\d{4,}$/.test(r.id))e('id missing or not EV-NNNN');
 else{if(seen.has(r.id))e('duplicate id');seen.add(r.id);nums.push(+r.id.slice(3));}
 if(!isS(r.date)||!/^\d{4}-\d{2}-\d{2}/.test(r.date)||isNaN(Date.parse(r.date)))e('date missing or not ISO');
 for(const f of ['name','test','under_test','description'])if(!isS(r[f]))e('missing/empty field: '+f);
 if(!Array.isArray(r.entities)||!r.entities.every(isS))e('entities must be an array of non-empty strings');
 if(!Array.isArray(r.media))e('media must be an array');
 else r.media.forEach((m,j)=>{const x=w+' media['+j+']: ';
  if(!m||typeof m!=='object')return errs.push(x+'not an object');
  if(!MT.includes(m.type))errs.push(x+'bad type '+JSON.stringify(m.type));
  if(!isS(m.caption))errs.push(x+'missing caption');
  if(!safe(m.path))return errs.push(x+'unsafe or missing path '+JSON.stringify(m.path));
  const f=path.join(base,m.path);
  if(!fs.existsSync(f)||!fs.statSync(f).isFile())errs.push(x+'file not found: '+m.path);});
 if('kind' in r&&!KIND.includes(r.kind))e('bad kind '+JSON.stringify(r.kind));
 if('status' in r&&!ST.includes(r.status))e('bad status '+JSON.stringify(r.status));
 if(r.kind==='unexpected'&&!r.reproduction)warns.push(w+': unexpected finding without reproduction');
 if('reproduction' in r){const p=r.reproduction;
  if(!p||!Number.isInteger(p.runs)||!Number.isInteger(p.reproduced)||p.runs<1||p.reproduced<0||p.reproduced>p.runs||!isS(p.how))e('reproduction needs integer runs>=1, 0<=reproduced<=runs, and how');}
 if('why_it_matters' in r&&!isS(r.why_it_matters))e('why_it_matters must be a non-empty string');
 if('links' in r&&!(Array.isArray(r.links)&&r.links.every(isS)))e('links must be an array of strings');
 if('decision_needed' in r&&r.decision_needed!==null){const d=r.decision_needed;
  if(typeof d!=='object'||!isS(d.question)||!Array.isArray(d.options)||d.options.length<2||!d.options.every(o=>o&&isS(o.label)&&isS(o.consequence))||!isS(d.recommendation)||!isS(d.default_if_no_answer))
   e('decision_needed needs question, >=2 options {label,consequence}, recommendation, default_if_no_answer');}
});
const sorted=[...nums].sort((a,b)=>a-b);
for(let i=1;i<sorted.length;i++)if(sorted[i]-sorted[i-1]>1)warns.push('id gap between EV-'+String(sorted[i-1]).padStart(4,'0')+' and EV-'+String(sorted[i]).padStart(4,'0'));
console.log('records: '+L.length);
warns.forEach(m=>console.log('WARN  '+m));
errs.forEach(m=>console.log('ERROR '+m));
console.log(errs.length?errs.length+' error(s)':'OK');
process.exit(errs.length?1:0);
JS
