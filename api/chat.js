// Legacy Travel OS proxy intentionally disabled.
// Personal context and AI proxy logic must not live in the public Brain source tree.
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  return res.status(410).json({error:'LEGACY_ENDPOINT_DISABLED'});
}
