from pathlib import Path
import json
root=Path('/mnt/data/rebuild')

def read(name):
    return (root/name).read_text(encoding='utf-8')

def js_string(s):
    # JSON string safe inside a script tag; prevent </script> termination
    return json.dumps(s, ensure_ascii=False).replace('</script','<\\/script')

pages={n:read(n) for n in ['index.html','equipment.html','meters.html','feeders.html','dwg-inspector.html']}
preview=f'''<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>معاينة قسم الصيانة</title>
<style>
*{{box-sizing:border-box}}body{{margin:0;background:#eef5f2;color:#16382e;font-family:Arial,Tahoma,sans-serif}}
.top{{position:sticky;top:0;z-index:50;background:#07583f;color:#fff;padding:12px 14px;box-shadow:0 2px 12px #0003}}
.top h1{{margin:0;font-size:20px}}.top p{{margin:4px 0 0;font-size:12px;opacity:.9}}
.tabs{{display:flex;gap:7px;overflow:auto;padding:10px 0 2px}}.tabs button{{border:0;background:#e5f0ec;color:#07583f;border-radius:11px;padding:9px 12px;font-weight:700;white-space:nowrap;cursor:pointer}}.tabs button.active{{background:#fff;color:#07583f}}
.framewrap{{padding:10px;max-width:1500px;margin:auto}}iframe{{width:100%;height:calc(100vh - 145px);min-height:650px;border:0;border-radius:16px;background:#fff;box-shadow:0 3px 18px #0001}}
.note{{max-width:1500px;margin:8px auto 0;padding:10px 14px;background:#fff8df;border:1px solid #eadcae;border-radius:12px;color:#6e5a16;font-size:13px;line-height:1.7}}
</style></head><body>
<div class="top"><h1>🛠️ معاينة قسم الصيانة</h1><p>تصفح المشروع هنا قبل تنزيل أي نسخة. البيانات لا تُعدّل من هذه المعاينة.</p>
<div class="tabs">
<button onclick="show('home',this)" class="active">⌂ الرئيسية</button>
<button onclick="show('equipment',this)">⚡ مواقع المعدات</button>
<button onclick="show('meters',this)">🔢 مواقع العدادات</button>
<button onclick="show('feeders',this)">🔌 مواقع المغذيات</button>
<button onclick="show('inspector',this)">🧰 بيانات الرسم</button>
</div></div>
<div class="note" id="note">المعاينة تعمل كواجهة واحدة. عند اختيار أي قسم يتم فتحه داخلها بدل تنزيل ZIP كل مرة.</div>
<div class="framewrap"><iframe id="frame" title="معاينة القسم"></iframe></div>
<script>
const PAGES={{
 home:{js_string(pages['index.html'])},
 equipment:{js_string(pages['equipment.html'])},
 meters:{js_string(pages['meters.html'])},
 feeders:{js_string(pages['feeders.html'])},
 inspector:{js_string(pages['dwg-inspector.html'])}
}};
const frame=document.getElementById('frame');
function show(name,btn){{frame.srcdoc=PAGES[name];document.querySelectorAll('.tabs button').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');
 document.getElementById('note').textContent = name==='feeders' ? 'قسم المغذيات: الواجهة موجودة، لكن استخراج قاعدة DWG النهائية ما زال منفصلًا عن المعاينة حتى لا نعرض بيانات غير مؤكدة.' : 'هذا القسم يُعرض من نفس ملفات المشروع الحالية.';
}}
show('home',document.querySelector('.tabs button'));
</script></body></html>'''
(root/'preview.html').write_text(preview,encoding='utf-8')
print((root/'preview.html').stat().st_size)
