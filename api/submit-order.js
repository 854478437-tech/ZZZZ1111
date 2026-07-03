const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY.trim()
);

const COST = { text2img: 120, img2img: 160, text2video: 1200 };

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: '只允许 POST 请求' });

    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: '未登录' });
    const token = authHeader.replace('Bearer ', '');

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: '身份验证失败' });

    const { mode, prompt } = req.body;
    const requiredPoints = COST[mode];
    if (!requiredPoints) return res.status(400).json({ error: '无效的生成模式' });

    // 1. 严格查账：获取用户当前积分
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('points')
        .eq('id', user.id)
        .single();
        
    if (profileError || !profile) return res.status(500).json({ error: '无法获取积分信息' });

    // 2. 拦截：积分不够直接报错返回
    if (profile.points < requiredPoints) {
        return res.status(403).json({ error: `积分不足！需要 ${requiredPoints} 积分，您当前只有 ${profile.points} 积分。` });
    }

    // 3. 扣费：更新数据库积分
    const newPoints = profile.points - requiredPoints;
    const { error: updateError } = await supabase
        .from('profiles')
        .update({ points: newPoints })
        .eq('id', user.id);

    if (updateError) return res.status(500).json({ error: '扣费失败，请重试' });

    // 4. 接单：存入 orders 表
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{ 
            user_id: user.id, 
            prompt: prompt,
            status: 'waiting'
        }])
        .select()
        .single();

    if (orderError) return res.status(500).json({ error: '订单创建失败' });

    // 5. 成功返回最新积分给前端
    return res.status(200).json({ success: true, remaining_points: newPoints, order_id: order.id });
};
