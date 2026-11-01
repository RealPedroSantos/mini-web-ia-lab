import crypto from 'crypto';
import {cookies} from 'next/headers';
export const COOKIE_NAME='rumo_session';
export function hashPassword(value=''){return crypto.createHash('sha256').update(String(value)).digest('hex')}
export function validPassword(value=''){
  const expected=process.env.APP_PASSWORD_HASH||'';
  const received=hashPassword(value);
  if(!expected || expected.length!==received.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(received));
}
export async function isAuthenticated(){
  const token=process.env.SESSION_TOKEN||'';
  if(!token) return false;
  const store=await cookies();
  return store.get(COOKIE_NAME)?.value===token;
}
export async function requireAuthResponse(NextResponse){
  if(await isAuthenticated()) return null;
  return NextResponse.json({error:'Sessão expirada. Entre novamente.'},{status:401});
}
