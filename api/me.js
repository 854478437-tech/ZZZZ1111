const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: '未登录' });
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: '身份验证失败' });

  // 🌟 这里加了 user.email，完美匹配你数据库里的 email 列，绝不报错！
  const { data: profile, error } = await supabase
    .from('profiles')
    .upsert(
      { id: user.id, email: user.email, points: 200, membership: 'free' },
      { onConflict: 'id', ignoreDuplicates: false }
    )
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json(profile);
};
