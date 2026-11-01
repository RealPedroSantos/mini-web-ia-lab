const API_BASE='https://api.pluggy.ai';
function creds(){const clientId=process.env.PLUGGY_CLIENT_ID,clientSecret=process.env.PLUGGY_CLIENT_SECRET;if(!clientId||!clientSecret){const e=new Error('Pluggy não configurada.');e.code='PLUGGY_NOT_CONFIGURED';throw e}return{clientId,clientSecret}}
export function isPluggyConfigured(){return Boolean(process.env.PLUGGY_CLIENT_ID&&process.env.PLUGGY_CLIENT_SECRET)}
async function safeJson(r){try{return await r.json()}catch{return{}}}
export async function getApiKey(){const {clientId,clientSecret}=creds();const r=await fetch(`${API_BASE}/auth`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId,clientSecret}),cache:'no-store'});const p=await safeJson(r);if(!r.ok||!p?.apiKey){const e=new Error(p?.message||p?.error||`Falha de autenticação Pluggy (${r.status})`);e.status=r.status;throw e}return p.apiKey}
export async function pluggyFetch(path,options={}){const apiKey=await getApiKey();const r=await fetch(`${API_BASE}${path}`,{...options,headers:{'content-type':'application/json','x-api-key':apiKey,...(options.headers||{})},cache:'no-store'});const p=await safeJson(r);if(!r.ok){const e=new Error(p?.message||p?.error||`Pluggy respondeu ${r.status}`);e.status=r.status;e.payload=p;throw e}return p}
export async function createConnectToken(clientUserId='owner'){return pluggyFetch('/connect_token',{method:'POST',body:JSON.stringify({options:{clientUserId,avoidDuplicates:true}})})}
export async function getAccounts(itemId){const p=await pluggyFetch(`/accounts?itemId=${encodeURIComponent(itemId)}`);return Array.isArray(p)?p:(p?.results||[])}
async function getAccountTransactions(accountId,dateFrom){
  const apiKey=await getApiKey(); let url=new URL(`${API_BASE}/v2/transactions`); url.searchParams.set('accountId',accountId); if(dateFrom) url.searchParams.set('dateFrom',dateFrom); let all=[]; let guard=0;
  while(url&&guard++<60){const r=await fetch(url,{headers:{'x-api-key':apiKey},cache:'no-store'});const p=await safeJson(r);if(!r.ok) throw new Error(p?.message||`Falha ao buscar transações (${r.status})`);all.push(...(p?.results||[]));if(!p?.next) break;url=new URL(p.next,`${API_BASE}/v2/transactions`)}return all
}
export async function getFinancialSnapshot(itemId,months=6){
  const accounts=await getAccounts(itemId);const from=new Date();from.setMonth(from.getMonth()-Math.min(12,Math.max(1,Number(months)||6)));const dateFrom=from.toISOString();const chunks=await Promise.all(accounts.map(async a=>{try{const tx=await getAccountTransactions(a.id,dateFrom);return tx.map(t=>({...t,accountId:a.id,accountType:a.type,accountSubtype:a.subtype,accountName:a.name||a.marketingName||a.number||'Conta'}))}catch{return[]}}));return{accounts,transactions:chunks.flat()}
}
