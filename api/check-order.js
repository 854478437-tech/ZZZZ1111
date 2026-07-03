const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL.trim(),
  process.env.SUPABASE_SERVICE_ROLE_KEY.trim()
);

module.exports = async function handler(req, res) {
  // 💡 关键新增：彻底禁用 Vercel 缓存，强制每次都去查最新数据库！
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: '未登录' });
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: '身份验证失败' });

  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    // 💡 如果报错，直接把错误拍在脸上，不再默默隐藏
    return res.status(500).json({ error: "数据库查询失败: " + error.message });
  }

  if (!order) {
    return res.status(200).json({ status: 'waiting', msg: '没有找到订单' });
  }

  return res.status(200).json({
    status: order.status,
    image_url: order.image_url,
    video_url: order.video_url
  });
};
