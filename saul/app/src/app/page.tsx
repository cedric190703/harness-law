import HarnessApp from '@/components/harness/HarnessApp';
export const dynamic='force-dynamic';
export default function Page(){return <HarnessApp online={process.env.SAUL_EN_LIGNE==='1'}/>;}
