const rateMap=globalThis.__roseStudyRateMap||(globalThis.__roseStudyRateMap=new Map());
function send(res,status,payload){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(payload))}
module.exports=async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return send(res,405,{error:'Use POST.'})}
 const origin=String(req.headers.origin||''),host=String(req.headers.host||'');
 if(origin){try{if(new URL(origin).host!==host)return send(res,403,{error:'Request origin is not allowed.'})}catch{return send(res,403,{error:'Invalid request origin.'})}}
 const key=process.env.GROQ_API_KEY;if(!key)return send(res,503,{error:'AI revision generation is not configured.',code:'missing_api_key'});
 const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim().slice(0,90),now=Date.now();
 for(const [k,v] of rateMap)if(now-v.start>60000)rateMap.delete(k);
 const slot=rateMap.get(ip)||{start:now,count:0};slot.count++;rateMap.set(ip,slot);if(slot.count>5)return send(res,429,{error:'Please pause briefly before making another study set.'});
 let body=req.body;try{if(typeof body==='string')body=JSON.parse(body);if(!body||typeof body!=='object')throw Error('bad')}catch{return send(res,400,{error:'Invalid request body.'})}
 const title=String(body.title||'Study notes').slice(0,120),notes=String(body.text||'').trim();
 if(notes.length<80)return send(res,400,{error:'This document does not contain enough extracted text to make a useful study set.'});
 if(notes.length>14000)return send(res,413,{error:'Choose a shorter extract of the notes (under 14,000 characters).'});
 const system='You create accurate study materials from supplied notes. Use only facts present in the notes. Do not invent details. Create 6 to 10 focused flashcards useful for active recall. Return only valid JSON with this shape: {"cards":[{"question":"...","answer":"...","explanation":"...","options":["option A","option B","option C","option D"],"correctIndex":0}]}. Each options array must have four short plausible choices, one correct choice at correctIndex. The correct choice must agree with answer. Questions should be clear and distinct. If the notes are too thin, create fewer excellent cards rather than padding. No markdown fences.';
 try{
  const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify({model:'openai/gpt-oss-20b',messages:[{role:'system',content:system},{role:'user',content:'Document title: '+title+'\n\nStudy notes:\n'+notes}],temperature:0.2,max_tokens:2200}),signal:AbortSignal.timeout(35000)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok){console.error('Groq study generation error',response.status,result?.error?.code||'provider_error');return send(res,response.status===429?429:502,{error:response.status===429?'The AI rate limit was reached. Try again later.':'AI revision generation did not succeed. You can still make a local study set.'})}
  const raw=String(result?.choices?.[0]?.message?.content||'').trim();
  const first=raw.indexOf('{'),last=raw.lastIndexOf('}');if(first<0||last<=first)return send(res,502,{error:'The AI returned an unreadable study set.'});
  let parsed;try{parsed=JSON.parse(raw.slice(first,last+1))}catch{return send(res,502,{error:'The AI returned invalid study-set formatting.'})}
  const cards=(Array.isArray(parsed.cards)?parsed.cards:[]).slice(0,12).map(c=>{
   const question=String(c?.question||'').trim().slice(0,350),answer=String(c?.answer||'').trim().slice(0,1200),explanation=String(c?.explanation||answer).trim().slice(0,1200);
   let options=Array.isArray(c?.options)?c.options.map(v=>String(v||'').trim().slice(0,300)).filter(Boolean).slice(0,4):[];
   if(question.length<5||answer.length<2)return null;
   if(!options.some(v=>v.toLowerCase()===answer.toLowerCase()))options=[answer,...options].slice(0,4);
   while(options.length<4)options.push('Not stated in the supplied notes');
   let correctIndex=Number(c?.correctIndex);if(!Number.isInteger(correctIndex)||correctIndex<0||correctIndex>=options.length||options[correctIndex].toLowerCase()!==answer.toLowerCase())correctIndex=options.findIndex(v=>v.toLowerCase()===answer.toLowerCase());
   if(correctIndex<0)correctIndex=0;
   return {question,answer,explanation,options,correctIndex};
  }).filter(Boolean);
  if(cards.length<3)return send(res,502,{error:'There were not enough reliable cards in the generated set. Try local quick cards instead.'});
  return send(res,200,{title,cards,source:'ai',model:'openai/gpt-oss-20b'});
 }catch(e){console.error('Groq study generation failed');return send(res,504,{error:'AI revision generation timed out. You can still make a local study set.'})}
};
