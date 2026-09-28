export default function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({ok:false,error:'GET only'});
  return res.status(200).json({
    ok:true,
    apiConfigured:Boolean(process.env.OPENAI_API_KEY),
    model:process.env.OPENAI_MODEL||'gpt-5.6-terra',
    mode:'prototype'
  });
}
