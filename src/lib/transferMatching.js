// Concilia transferencias entre contas autorizadas. Evita classificar coincidencias como receita/despesa sem revisao.
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const description = t => normalize(t?.description || t?.descriptionRaw || t?.merchant?.name || '');
const transferWord = /\b(pix|ted|doc|transferencia|transfer|transf|movimentacao|aplicacao|resgate|remessa)\b/;
const ownWord = /(mesma titularidade|titularidade propria|mesmo titular|minha conta|minhas contas|conta propria|entre contas proprias|entre minhas contas|para mim mesmo|de mim para mim|transferencia interna)/;
const moneyCents = value => Math.round(Math.abs(Number(value) || 0) * 100);
const day = t => { const ms = Date.parse(String(t?.date || '')); return Number.isFinite(ms) ? Math.floor(ms / 86400000) : null; };
const refs = t => [
  t?.paymentData?.endToEndId, t?.paymentData?.endToEndID,
  t?.paymentData?.pixEndToEndId, t?.endToEndId, t?.pix?.endToEndId,
].map(x => String(x || '').trim().toLowerCase()).filter(x => x.length >= 12);
const hash = raw => {
  let h1 = 2166136261, h2 = 16777619;
  for (const ch of String(raw)) {
    const n = ch.charCodeAt(0);
    h1 = Math.imul(h1 ^ n, 16777619);
    h2 = Math.imul(h2 ^ n, 2246822519);
  }
  return (h1 >>> 0).toString(16).padStart(8,'0') + (h2 >>> 0).toString(16).padStart(8,'0');
};
const identity = t => String(t?.id || [t?.accountId, t?.date, t?.amount, t?.description].join(':'));
export function detectOwnAccountTransfers(transactions, accounts = [], confirmedKeys = [], rejectedKeys = []) {
  const names = new Map(accounts.map(a => [String(a.id), String(a.name || a.marketingName || a.number || 'Conta')]));
  const accepted = new Set(confirmedKeys);
  const rejected = new Set(rejectedKeys);
  const credits = new Map();
  transactions.forEach((t,i) => {
    if (t.type !== 'CREDIT' || !t.accountId || t.accountType === 'CREDIT_CARD') return;
    const v = moneyCents(t.amount); if (!v) return;
    if (!credits.has(v)) credits.set(v, []);
    credits.get(v).push({ t,i,date:day(t), label:description(t), refs:refs(t) });
  });
  const options = [];
  transactions.forEach((t,i) => {
    if (t.type !== 'DEBIT' || !t.accountId || t.accountType === 'CREDIT_CARD') return;
    const amount = moneyCents(t.amount); if (!amount) return;
    const date = day(t), label = description(t), outRefs = refs(t);
    for (const inbound of credits.get(amount) || []) {
      if (String(t.accountId) === String(inbound.t.accountId)) continue;
      if (date === null || inbound.date === null) continue;
      const gap = Math.abs(date - inbound.date);
      if (gap > 2) continue;
      const commonReference = outRefs.length && inbound.refs.some(ref => outRefs.includes(ref));
      const own = ownWord.test(label) || ownWord.test(inbound.label);
      const looksLikeTransfer = transferWord.test(label) && transferWord.test(inbound.label);
      if (!commonReference && !own && !looksLikeTransfer) continue;
      const automaticallySafe = Boolean(commonReference || own);
      const key = 'tr_' + hash(identity(t) + '=>' + identity(inbound.t));
      options.push({
        key, outIndex: i, inIndex: inbound.i, amount: amount / 100, gap,
        automaticallySafe, score: (commonReference ? 100 : 0) + (own ? 50 : 0) + (looksLikeTransfer ? 10 : 0) - gap,
        date: String(t.date || '').slice(0,10),
        fromAccount: names.get(String(t.accountId)) || String(t.accountName || 'Conta de origem'),
        toAccount: names.get(String(inbound.t.accountId)) || String(inbound.t.accountName || 'Conta de destino'),
        fromDescription: String(t.description || t.descriptionRaw || '').slice(0,100),
        toDescription: String(inbound.t.description || inbound.t.descriptionRaw || '').slice(0,100),
      });
    }
  });
  options.sort((a,b)=>b.score-a.score || a.key.localeCompare(b.key));
  const used = new Set(), excludedIndices = new Set(), pending = [];
  let count = 0, volume = 0, automatic = 0, confirmed = 0;
  for (const p of options) {
    if (used.has(p.outIndex) || used.has(p.inIndex)) continue;
    if (rejected.has(p.key)) continue;
    used.add(p.outIndex); used.add(p.inIndex);
    if (p.automaticallySafe || accepted.has(p.key)) {
      excludedIndices.add(p.outIndex); excludedIndices.add(p.inIndex);
      count++; volume += p.amount;
      if (p.automaticallySafe) automatic++; else confirmed++;
    } else {
      pending.push({key:p.key,amount:p.amount,date:p.date,fromAccount:p.fromAccount,toAccount:p.toAccount,fromDescription:p.fromDescription,toDescription:p.toDescription});
    }
  }
  return {excludedIndices, count, volume:Math.round(volume*100)/100, automatic, confirmed, pending:pending.slice(0,40), pendingTotal:pending.length};
}