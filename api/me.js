const { createClient } = require('@supabase/supabase-js');

// 加上 .trim() 保证不出玄学换行符报错
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

  // 💡 关键修复：把 ignoreDuplicates 改成了 true！
  // 这样只有在新用户【第一次】注册时才会送 200 积分，老用户刷新绝对不会再被覆盖！
  const { data: profile, error } = await supabase
    .from('profiles')
    .upsert(
      { id: user.id, email: user.email, points: 200, membership: 'free' },
      { onConflict: 'id', ignoreDuplicates: true } 
    )
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json(profile);
};
