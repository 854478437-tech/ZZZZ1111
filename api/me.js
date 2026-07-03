const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL.trim(),
  process.env.SUPABASE_SERVICE_ROLE_KEY.trim()
);

module.exports = async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: '未登录' });
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: '身份验证失败' });

  // 1. 先尝试查询用户的档案
  let { data: profile, error: selectError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // 2. 如果没有查到档案（说明是纯新用户第一次登录）
  if (!profile) {
    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert([{ id: user.id, email: user.email, points: 200, membership: 'free' }])
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({ error: '创建用户档案失败' });
    }
    profile = newProfile; // 把刚送了 200 积分的新档案赋值过去
  }

  // 3. 无论新老用户，安全返回档案，绝不报错，也绝不覆盖老积分！
  return res.status(200).json(profile);
};
