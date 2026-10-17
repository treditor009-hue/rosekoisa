function send(res,status,payload){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(payload))}
async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return send(res,405,{error:'Use POST.'})}
 const origin=String(req.headers.origin||''),host=String(req.headers.host||'');
 if(origin){try{if(new URL(origin).host!==host)return send(res,403,{error:'Request origin is not allowed.'})}catch{return send(res,403,{error:'Invalid request origin.'})}}
 const key=process.env.GROQ_API_KEY;if(!key)return send(res,503,{error:'Add GROQ_API_KEY in Vercel Environment Variables to enable transcription.',code:'missing_api_key'});
 let body=req.body;try{if(typeof body==='string')body=JSON.parse(body);if(!body||typeof body!=='object')throw Error('bad')}catch{return send(res,400,{error:'Invalid request body.'})}
 const base64=String(body.fileBase64||'');if(!base64)return send(res,400,{error:'No audio file was received.'});if(base64.length>3600000)return send(res,413,{error:'Choose an audio file under 2.6 MB.'});
 const mime=String(body.mimeType||'audio/mpeg').slice(0,80),filename=String(body.fileName||'lecture-audio.webm').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100);
 if(!/\.(mp3|m4a|mp4|mpeg|mpga|wav|webm|ogg|flac)$/i.test(filename)&&!mime.startsWith('audio/'))return send(res,415,{error:'Choose MP3, M4A, WAV, OGG or WebM audio.'});
 try{
  const bytes=Buffer.from(base64,'base64');if(bytes.length>2700000)return send(res,413,{error:'Choose audio under 2.6 MB.'});
  const form=new FormData();form.append('file',new Blob([bytes],{type:mime}),filename);form.append('model','whisper-large-v3-turbo');form.append('response_format','json');
  const response=await fetch('https://api.groq.com/openai/v1/audio/transcriptions',{method:'POST',headers:{'Authorization':'Bearer '+key},body:form,signal:AbortSignal.timeout(50000)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok){console.error('Groq transcription error',response.status,result?.error?.code||'provider_error');return send(res,response.status===429?429:502,{error:response.status===429?'The transcription rate limit was reached. Try again later.':'Transcription failed. Try a shorter file or use browser Dictate.'})}
  const transcript=String(result.text||'').trim();if(!transcript)return send(res,502,{error:'No speech was detected in that audio file.'});return send(res,200,{text:transcript,model:'whisper-large-v3-turbo'})
 }catch(e){console.error('Groq transcription request failed');return send(res,504,{error:'Transcription timed out. Try a shorter recording.'})}
}
handler.config={api:{bodyParser:{sizeLimit:'4mb'}}};
module.exports=handler;