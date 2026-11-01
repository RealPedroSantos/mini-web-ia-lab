import{NextResponse}from'next/server';export function GET(){return NextResponse.json({ok:true,service:'rumo-finance-openfinance',timestamp:new Date().toISOString()})}
