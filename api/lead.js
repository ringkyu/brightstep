const { getSupabase } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, phone, region, service } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: '이름과 연락처는 필수입니다.' });
    }

    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.from('leads').insert({ name, phone, region, service });
      if (error) console.error('leads 저장 오류:', error.message);
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
