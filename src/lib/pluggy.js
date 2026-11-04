const API_BASE='https://api.pluggy.ai';
function creds(){const clientId=process.env.PLUGGY_CLIENT_ID,clientSecret=process.env.PLUGGY_CLIENT_SECRET;if(!clientId||!clientSecret){const e=new Error('Pluggy não configurada.');e.code='PLUGGY_NOT_CONFIGURED';throw e}return{clientId,clientSecret}}
export function isPluggyConfigured(){return Boolean(process.env.PLUGGY_CLIENT_ID&&process.env.PLUGGY_CLIENT_SECRET)}
async function safeJson(r){try{return await r.json()}catch{return{}}}
export async function getApiKey(){const {clientId,clientSecret}=creds();const r=await fetch(`${API_BASE}/auth`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId,clientSecret}),cache:'no-store'});const p=await safeJson(r);if(!r.ok||!p?.apiKey){const e=new Error(p?.message||p?.error||`Falha de autenticação Pluggy (${r.status})`);e.status=r.status;throw e}return p.apiKey}
export async function pluggyFetch(path,options={}){const apiKey=await getApiKey();const r=await fetch(`${API_BASE}${path}`,{...options,headers:{'content-type':'application/json','x-api-key':apiKey,...(options.headers||{})},cache:'no-store'});const p=await safeJson(r);if(!r.ok){const e=new Error(p?.message||p?.error||`Pluggy respondeu ${r.status}`);e.status=r.status;e.payload=p;throw e}return p}
export async function createConnectToken(clientUserId='owner'){/* O MeuPluggy (conector 200) usa o mesmo login para autorizar bancos diferentes. */return pluggyFetch('/connect_token',{method:'POST',body:JSON.stringify({options:{clientUserId,avoidDuplicates:false}})})}
export async function getAccounts(itemId){const p=await pluggyFetch(`/accounts?itemId=${encodeURIComponent(itemId)}`);return Array.isArray(p)?p:(p?.results||[])}
async function getAccountTransactions(accountId,dateFrom){
  const apiKey=await getApiKey(); let url=new URL(`${API_BASE}/v2/transactions`); url.searchParams.set('accountId',accountId); if(dateFrom) url.searchParams.set('dateFrom',dateFrom); let all=[]; let guard=0;
  while(url&&guard++<60){const r=await fetch(url,{headers:{'x-api-key':apiKey},cache:'no-store'});const p=await safeJson(r);if(!r.ok) throw new Error(p?.message||`Falha ao buscar transações (${r.status})`);all.push(...(p?.results||[]));if(!p?.next) break;url=new URL(p.next,`${API_BASE}/v2/transactions`)}return all
}
export async function getInvestments(itemId){
  const results=[];
  for(let page=1;page<=10;page++){
    const data=await pluggyFetch(`/investments?itemId=${encodeURIComponent(itemId)}&page=${page}&pageSize=500`);
    const batch=data?.results||[];
    results.push(...batch);
    if(!batch.length||page>=Number(data?.totalPages||1))break;
  }
  return results;
}
export async function getFinancialSnapshot(input,months=6){
  const ids=[...new Set((Array.isArray(input)?input:[input]).filter(id=>typeof id==='string'&&id.trim()))].slice(0,10);
  if(!ids.length)throw new Error('Selecione pelo menos uma instituição financeira.');
  const from=new Date();from.setMonth(from.getMonth()-Math.min(12,Math.max(1,Number(months)||6)));
  const dateFrom=from.toISOString().slice(0,10); // Pluggy exige AAAA-MM-DD, não ISO timestamp.
  const items=await Promise.all(ids.map(async(id,index)=>{
    const fallback=`Instituição ${index+1}`;
    try{
      const item=await pluggyFetch(`/items/${encodeURIComponent(id)}`);
      const institution=item?.connector?.name||fallback;
      const warnings=[];
      if(item?.status&&item.status!=='UPDATED')warnings.push(`${institution}: conexão em estado ${item.status}. Verifique se o consentimento foi concluído.`);
      if(item?.hasResourcesPendingAuthorization)warnings.push(`${institution}: há contas ou investimentos aguardando autorização no banco.`);
      if(item?.executionStatus&&item.executionStatus!=='SUCCESS')warnings.push(`${institution}: ${item.executionStatus}.`);
      let accounts=[];try{accounts=await getAccounts(id)}catch(error){warnings.push(`${institution}: consulta das contas indisponível (${error?.message||'erro'}).`)}
      let investments=[];if(item?.products?.includes('INVESTMENTS'))try{investments=await getInvestments(id)}catch(error){warnings.push(`${institution}: investimentos indisponíveis (${error?.message||'erro'}).`)}
      if(!accounts.length&&!investments.length)warnings.push(`${institution}: nenhuma conta ou investimento foi disponibilizado para este consentimento.`);
      if(item?.connector?.isOpenFinance===false&&Number(item?.connector?.id)!==200)warnings.push(`${institution}: conexão direta em vez de Open Finance. Consulte o tipo de conector autorizado.`);
      const transactionResults=await Promise.allSettled(accounts.map(async(account)=>{
        const transactions=await getAccountTransactions(account.id,dateFrom);
        return transactions.map(t=>({...t,accountId:account.id,accountType:account.type,accountSubtype:account.subtype,accountName:account.name||account.marketingName||account.number||'Conta',itemId:id}));
      }));
      const transactions=[];
      transactionResults.forEach((result,i)=>{
        if(result.status==='fulfilled')transactions.push(...result.value);
        else warnings.push(`${institution}: não foi possível ler transações de ${accounts[i]?.name||'uma conta'} (${result.reason?.message||'erro desconhecido'}).`);
      });
      return {id,institution,status:item?.status||'UNKNOWN',isOpenFinance:Boolean(item?.connector?.isOpenFinance),accounts,transactions,investments,warnings};
    }catch(error){return {id,institution:fallback,status:'ERROR',isOpenFinance:null,accounts:[],transactions:[],investments:[],warnings:[`${fallback}: ${error?.message||'falha na sincronização'}.`]}}
  }));
  const accounts=items.flatMap(i=>i.accounts);const transactions=items.flatMap(i=>i.transactions);const investments=items.flatMap(i=>i.investments);
  const warnings=items.flatMap(i=>i.warnings);
  if(!accounts.length&&!investments.length){const detail=warnings.slice(0,2).join(' ');throw new Error(detail||'Nenhum dado bancário disponível. Confirme a autorização no banco.');}
  return {accounts,transactions,investments,warnings,institutions:items.map(({institution,status,isOpenFinance,accounts,transactions,investments})=>({name:institution,status,isOpenFinance,accounts:accounts.length,transactions:transactions.length,investments:investments.length}))};
}
