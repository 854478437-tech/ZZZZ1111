// api/submit-order.js
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const COST = { text2img: 120, img2img: 160, text2video: 1200 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST 请求' });
  }

  // 验证用户身份
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: '未登录' });
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: '身份验证失败' });

  const { mode, prompt } = req.body;
  if (!mode || !COST[mode]) return res.status(400).json({ error: '无效的生成模式' });

  // 获取用户最新积分
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (profileError || !profile) return res.status(500).json({ error: '用户数据异常' });

  if (profile.points < COST[mode]) {
    return res.status(400).json({ error: '积分不足' });
  }

  // 扣除积分
  const newPoints = profile.points - COST[mode];
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ points: newPoints })
    .eq('id', user.id);
  if (updateError) return res.status(500).json({ error: '扣减积分失败' });

  // 创建订单
  const { error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: user.id,
      prompt: prompt || '',
      status: 'processing'
    });
  if (orderError) {
    // 如果订单创建失败，退回积分（简单补偿机制）
    await supabase.from('profiles').update({ points: profile.points }).eq('id', user.id);
    return res.status(500).json({ error: '创建订单失败，积分已退回' });
  }

  // 发送微信通知（Server酱）
  if (process.env.SERVERCHAN_SENDKEY) {
    const notifyMsg = `新订单\n用户：${user.email}\n模式：${mode}\n提示词：${prompt || '无'}\n剩余积分：${newPoints}`;
    await fetch(`https://sctapi.ftqq.com/${process.env.SERVERCHAN_SENDKEY}.send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `title=新AI订单&desp=${encodeURIComponent(notifyMsg)}`
    }).catch(() => {}); // 通知失败不影响主流程
  }

  return res.status(200).json({ success: true, remainingPoints: newPoints });
}