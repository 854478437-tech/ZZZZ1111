const { createClient } = require('@supabase/supabase-js');

// 同样带上 .trim()，防止上帝钥匙的换行符报错
const supabase = createClient(
  process.env.SUPABASE_URL.trim(),
  process.env.SUPABASE_SERVICE_ROLE_KEY.trim()
);

module.exports = async function handler(req, res) {
  // 1. 验证身份，确认是谁在查订单
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: '未登录' });
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: '身份验证失败' });

  // 2. 去数据库查询这个用户【最新】的一条订单
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false }) // 按时间倒序，拿最新的
    .limit(1)
    .single();

  if (error || !order) {
    // 如果数据库没查到订单，就让前端继续等
    return res.status(200).json({ status: 'waiting' });
  }

  // 3. 把数据库里的真实状态和链接原封不动发给前端！
  return res.status(200).json({
    status: order.status,
    image_url: order.image_url,
    video_url: order.video_url
  });
};
