# تطبيق Android — قسم الصيانة

هذه نسخة Android مستقلة من مشروع `ops11141/sec`.

## مبدأ الحماية
- المشروع الأصلي على `main` لم يتم تعديله.
- تطوير Android موجود في فرع `android-app`.
- التطبيق الحالي عبارة عن WebView محسّن يفتح نسخة GitHub Pages من المشروع.
- أي تطوير لاحق للتطبيق يمكن عمله داخل هذا الفرع بدون المساس بالمشروع الأساسي.

## التشغيل
افتح مجلد `android` في Android Studio ثم نفّذ Build > Build APK(s).

رابط المشروع الذي يفتحه التطبيق:
`https://ops11141.github.io/sec/`

## GitHub Actions
يوجد ملف:
`.github/workflows/build-android.yml`

تم تجهيز البناء التلقائي للـ APK.
