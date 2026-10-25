const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
export default async request=>{
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(request.method!=="POST")return json({error:"Method not allowed"},405);
 const url=Netlify.env.get("SUPABASE_URL"),key=Netlify.env.get("SUPABASE_SECRET_KEY");
 if(!url||!key)return json({error:"Server configuration is missing"},500);
 let body;try{body=await request.json()}catch{return json({error:"Invalid JSON"},400)}
 const playerId=String(body.player_id||"").trim(),name=String(body.player_name||"").trim();
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(playerId))return json({error:"Не удалось проверить идентификатор игрока. Обнови страницу и попробуй снова."},400);
 if(!name||name.length>18||/[<>\u0000-\u001f]/.test(name))return json({error:"Некорректное имя игрока: имя должно содержать до 18 символов."},400);
 try{
  const r=await fetch(url.replace(/\/+$/,"")+"/rest/v1/rpc/claim_player_name",{method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({p_player_id:playerId,p_display_name:name})});
  if(!r.ok){console.error("Name claim RPC",r.status,(await r.text()).slice(0,300));return json({error:"Не удалось проверить имя. Попробуй ещё раз."},502)}
  const rows=await r.json(),result=Array.isArray(rows)?rows[0]:rows;
  if(!result||!result.ok)return json({ok:false,code:result?.reason==="taken"?"NAME_TAKEN":"INVALID_NAME",error:result?.reason==="taken"?"ИГРОК С ТАКИМ ИМЕНЕМ УЖЕ ЕСТЬ, ПРИДУМАЙ ДРУГОЕ":"Не удалось сохранить имя. Проверь его и попробуй снова."},409);
  return json({ok:true,player_name:result.canonical_name});
 }catch(e){console.error("Claim player name:",e);return json({error:"Ошибка соединения при проверке имени."},500)}
};