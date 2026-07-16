import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  const publicKey = 'BI34U_bCSxQ6M8lxrlutHEzb26YuO-mI-bkT5d_CpCeUFW7AbA2mSfAW_QwETVl46bpnbgEMm1XvSwJYFi5ONwE';
  res.status(200).send(publicKey);
}
