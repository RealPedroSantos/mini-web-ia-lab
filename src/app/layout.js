import './styles.css';
export const metadata={title:'Rumo Finance',description:'Controle financeiro via Open Finance com plano de saída do Brasil.',manifest:'/manifest.webmanifest',icons:{icon:[{url:'/icons/icon-192.png',sizes:'192x192',type:'image/png'},{url:'/icons/icon-512.png',sizes:'512x512',type:'image/png'}],apple:[{url:'/apple-touch-icon.png',sizes:'180x180',type:'image/png'}]}};
export const viewport={themeColor:'#07100d'};
export default function RootLayout({children}){return <html lang="pt-BR"><body>{children}</body></html>}
