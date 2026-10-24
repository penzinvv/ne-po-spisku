const APP_ID = "54842965";
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const json = (data,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const enc = v=>encodeURIComponent(v).replace(/%20/g,"+").replace(/[!'()~]/g,c=>"%"+c.charCodeAt(0).toString(16).toUpperCase()).replace(/\*/g,"%2A");
async function verify(raw){
  const secret=Netlify.env.get("VK_APP_SECRET");
  if(!secret) throw new Error("Missing VK_APP_SECRET");
  const p=new URLSearchParams(String(raw||"").replace(/^\?/,""));
  const sign=p.get("sign")||"", app=p.get("vk_app_id")||"", uid=p.get("vk_user_id")||"";
  if(app!==APP_ID||!/^\d{1,20}$/.test(uid)||!sign)return null;
  const canonical=[...p.entries()].filter(([k])=>k.startsWith("vk_")).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>enc(k)+"="+enc(v)).join("&");
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const digest=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(canonical)));
  let bin="";digest.forEach(b=>bin+=String.fromCharCode(b));
  const expected=btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
  if(expected.length!==sign.length)return null;let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^sign.charCodeAt(i);
  return diff===0?uid:null;
}
export default async request=>{
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(!["GET","POST"].includes(request.method))return json({error:"Method not allowed"},405);
  const db=Netlify.env.get("SUPABASE_URL"),service=Netlify.env.get("SUPABASE_SECRET_KEY");
  if(!db||!service)return json({error:"Server configuration is missing"},500);
  let body={};if(request.method==="POST"){try{body=await request.json()}catch{return json({error:"Invalid JSON"},400)}}
  const launch=request.method==="GET"?new URL(request.url).searchParams.get("launch_params"):body.launch_params;
  let uid;try{uid=await verify(launch)}catch(e){console.error("VK auth config:",e.message);return json({error:"VK authentication is not configured"},500)}
  if(!uid)return json({error:"VK launch signature is invalid"},401);
  const endpoint=db.replace(/\/+$/,"")+"/rest/v1/player_profiles";
  const headers={apikey:service,Authorization:"Bearer "+service,"Content-Type":"application/json",Accept:"application/json"};
  try{
    if(request.method==="GET"){
      const r=await fetch(endpoint+"?vk_user_id=eq."+encodeURIComponent(uid)+"&select=vk_user_id,profile_name,save_data,updated_at&limit=1",{headers});
      if(!r.ok){console.error("Profile read:",r.status,(await r.text()).slice(0,300));return json({error:"Could not load profile"},502)}
      const rows=await r.json();return json({ok:true,exists:rows.length>0,profile:rows[0]||null});
    }
    const data=body.save_data;
    if(!data||typeof data!=="object"||Array.isArray(data)||JSON.stringify(data).length>180000)return json({error:"Invalid or too large profile data"},400);
    const n=data.banquetPlayerProfile&&data.banquetPlayerProfile.name;
    const name=(typeof n==="string"?n:"НОВЫЙ СОТРУДНИК").trim().slice(0,18)||"НОВЫЙ СОТРУДНИК";
    const r=await fetch(endpoint+"?on_conflict=vk_user_id",{method:"POST",headers:{...headers,Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({vk_user_id:uid,profile_name:name,save_data:data,updated_at:new Date().toISOString()})});
    if(!r.ok){console.error("Profile save:",r.status,(await r.text()).slice(0,300));return json({error:"Could not save profile"},502)}
    return json({ok:true,saved:true});
  }catch(e){console.error("Profile function:",e);return json({error:"Unexpected server error"},500)}
};
