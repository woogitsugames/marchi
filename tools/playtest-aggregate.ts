// Usage: npx tsx tools/playtest-aggregate.ts results.csv
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
type Row = Record<string, string>;
export function parseCsv(input: string): Row[] {
  const records: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  input = input.replace(/^\uFEFF/, '');
  for (let i=0;i<input.length;i++) {
    const c=input[i]!;
    if (quoted) { if (c==='"' && input[i+1]==='"') { cell+='"'; i++; } else if (c==='"') quoted=false; else cell+=c; }
    else if (c==='"' && !cell) quoted=true;
    else if (c===',') { row.push(cell); cell=''; }
    else if (c==='\n' || c==='\r') { if(c==='\r' && input[i+1]==='\n') i++; row.push(cell); records.push(row); row=[]; cell=''; }
    else if(c==='"') throw new Error('Invalid quote in CSV'); else cell+=c;
  }
  if(quoted) throw new Error('Unclosed quoted field');
  if(cell || row.length) { row.push(cell); records.push(row); }
  const header=records.shift(); if(!header || new Set(header).size!==header.length) throw new Error('Missing or duplicate CSV headers');
  for(const field of ['participant_id','scenario_id','cohort','prior_training','preflight_ok','invalid_setup','time_s','correct','timeout','taps','assistance','issue_codes','auto_first_touch_s','auto_why_open_s','auto_first_fix','auto_outcome','auto_focus_status']) if(!header.includes(field)) throw new Error(`Missing column ${field}`);
  return records.filter(r=>r.some(Boolean)).map((r,i)=>{ if(r.length!==header.length) throw new Error(`CSV row ${i+2}: expected ${header.length} columns, got ${r.length}`); return Object.fromEntries(header.map((h,j)=>[h,r[j]!])); });
}
const num=(v:string|undefined):number|null=> { if(v===undefined || v.trim()==='') return null; const n=Number(v); return Number.isFinite(n)&&n>=0?n:null; };
const median=(values:(number|null)[]):number|null=> {const a=values.filter((x):x is number=>x!==null).sort((x,y)=>x-y);return a.length ? (a[Math.floor((a.length-1)/2)]!+a[Math.floor(a.length/2)]!)/2 : null;};
export function aggregate(rows:Row[]) {
  // First valid trial per participant/scenario; file order is the recording order.
  const seen=new Set<string>(); const groups=new Map<string,{valid:Row[], invalid:number}>(); const problems=new Map<string,number>();
  for(const r of rows){
    if(!r.participant_id || !r.scenario_id) throw new Error('participant_id and scenario_id are required');
    const k=JSON.stringify([r.scenario_id,r.cohort || '(brak)',r.prior_training || '(brak)']);
    const g=groups.get(k) ?? {valid:[],invalid:0}; groups.set(k,g);
    if(r.preflight_ok!=='1'||r.invalid_setup!=='0'){g.invalid++;continue;}
    const trial=JSON.stringify([r.participant_id,r.scenario_id]); if(seen.has(trial))continue; seen.add(trial);
    g.valid.push(r);
    for(const code of new Set((r.issue_codes ?? '').split(/[;,|]/).map(x=>x.trim()).filter(Boolean))) problems.set(code,(problems.get(code)??0)+1);
  }
  const scenarios=[...groups].map(([key,g])=>{
    const [scenario,cohort,training]=JSON.parse(key) as string[]; const valid=g.valid;
    const time=(r:Row)=>r.timeout==='1'?60:(num(r.time_s)===null?null:Math.min(60,num(r.time_s)!));
    const correct=valid.filter(r=>r.correct==='1' && r.assistance==='0');
    const under=correct.filter(r=>num(r.time_s)!==null && num(r.time_s)!<30 && r.timeout!=='1').length;
    return {scenario,cohort,training,n_valid:valid.length,n_invalid_preflight:g.invalid,n_correct:correct.length,n_under_30:under,percent_under_30:valid.length?under/valid.length*100:null,median_time_capped_s:median(valid.map(time)),median_correct_s:median(correct.map(time)),median_taps:median(valid.map(r=>num(r.taps)))};
  });
  return {scenarios,problems:[...problems].map(([code,count])=>({code,count})).sort((a,b)=>b.count-a.count||a.code.localeCompare(b.code))};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){if(!process.argv[2]) throw new Error('Usage: npx tsx tools/playtest-aggregate.ts results.csv');const out=aggregate(parseCsv(readFileSync(process.argv[2],'utf8'))); console.log('Per scenario / cohort / prior training (S5 remains separate):'); console.table(out.scenarios); console.log('TOP observed issue codes (valid first trials):'); console.table(out.problems);}
