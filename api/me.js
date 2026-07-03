const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

module.exports = async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: '未登录' });
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: '身份验证失败' });

  // 查询积分表
  let { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // 如果查不到记录（比如手动注册的账号），直接自动新建一条
  if (profileError || !profile) {
    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert({ id: user.id, points: 200, membership: 'free' })
      .select()
      .single();
    
    if (insertError) return res.status(500).json({ error: '创建积分记录失败' });
    profile = newProfile;
  }

  return res.status(200).json(profile);
};
