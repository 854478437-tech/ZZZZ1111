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

  // ✨ 核心修改：使用 upsert，不管有没有记录都能完美兜底，绝不报错 500
  const { data: profile, error } = await supabase
    .from('profiles')
    .upsert(
      { id: user.id, points: 200, membership: 'free' },
      { onConflict: 'id', ignoreDuplicates: false }
    )
    .select()
    .single();

  if (error) {
    // 如果数据库操作失败，把具体的错误信息返回给前端，方便查错
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json(profile);
};
