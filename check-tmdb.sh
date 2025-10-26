#!/bin/bash
# TMDB 配置检查脚本

echo "====== TMDB 配置检查 ======"
echo ""
echo "1. 检查环境变量:"
if [ -z "$TMDB_API_KEY" ]; then
    echo "❌ TMDB_API_KEY 未设置"
else
    echo "✅ TMDB_API_KEY 已设置: ${TMDB_API_KEY:0:8}..."
fi
echo ""
echo "2. 检查 .env.local 文件:"
if [ -f .env.local ]; then
    echo "✅ .env.local 文件存在"
    if grep -q "TMDB_API_KEY" .env.local; then
        echo "✅ .env.local 中包含 TMDB_API_KEY"
    else
        echo "❌ .env.local 中未找到 TMDB_API_KEY"
    fi
else
    echo "❌ .env.local 文件不存在"
fi
echo ""
echo "3. 下一步操作："
echo "   - 如果环境变量未设置，请配置后重启应用"
echo "   - 配置完成后，访问 /api/debug/tmdb-config 验证"
echo "   - 在管理后台开启 TMDB 演员搜索开关"
echo ""
