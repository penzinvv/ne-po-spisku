const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const TITLES=['ЛЕГЕНДА','МАРМЕЛАДНЫЙ','БУТЫЛКА','ДОСТАТОЧНО ХОРОШ','ВЕЧНЫЙ СТАЖЁР','КЛОУН','МОНОПОЛИСТ','БОРОДАТЫЙ'];
export default async request=>{
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405);
 const db=Netlify.env.get('SUPABASE_URL'),key=Netlify.env.get('SUPABASE_SECRET_KEY');
 if(!db||!key)return json({error:'Server configuration is missing'},500);
 const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json'};
 const endpoint=db.replace(/\\/+$/,'')+'/rest/v1/game_player_cosmetics';
 try{
  let body={};
  if(request.method==='POST'){try{body=await request.json()}catch{return json({error:'Invalid JSON'},400)}}
  const params=new URL(request.url).searchParams;
  const playerId=String(request.method==='GET'?params.get('player_id')||'':body.player_id||'').trim();
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(playerId))return json({error:'Invalid player id'},400);
  if(request.method==='GET'){
   const r=await fetch(endpoint+'?select=player_id,player_name,avatar_index,active_title,updated_at&player_id=eq.'+encodeURIComponent(playerId)+'&limit=1',{headers});
   if(!r.ok)return json({error:'Could not load player cosmetics'},502);
   const rows=await r.json();return json({ok:true,exists:!!rows[0],profile:rows[0]||null});
  }
  const name=typeof body.player_name==='string'?body.player_name.trim().slice(0,18):'Гость';
  const avatar=body.avatar_index;
  const title=body.active_title===''||body.active_title==null?null:body.active_title;
  if(!name||!Number.isInteger(avatar)||avatar<0||avatar>25||(title!==null&&!TITLES.includes(title)))return json({error:'Invalid player name, avatar or title'},400);
  const r=await fetch(endpoint+'?on_conflict=player_id',{method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({player_id:playerId,player_name:name,avatar_index:avatar,active_title:title,updated_at:new Date().toISOString()})});
  if(!r.ok){console.error('Cosmetics save:',r.status,(await r.text()).slice(0,300));return json({error:'Could not save player cosmetics'},502)}
  return json({ok:true,saved:true});
 }catch(e){console.error('Player cosmetics:',e);return json({error:'Unexpected server error'},500)}
};