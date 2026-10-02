# Kosmos dizaynı — dəyişikliklər

Kitabxana saytı `C:\Users\ACER\Pictures\login.mp4` videosundakı üslubda yenidən quruldu. Videoda qara kosmos fonu, ulduzlar və mərkəzdəki parlaq, yumru kənarlı qutunun ətrafında burulğan kimi fırlanan işıq zolaqları var.

## Necə açmaq olar

```
cd frontend
node serve.js
```

Sonra brauzerdə **http://localhost:8765** açın. Dayandırmaq üçün terminalda `Ctrl + C` basın.

## Səhifələr

### Yükləmə — `index.html`
- Mərkəzdə iri **"Yeni bir səhifə"** başlığı və altında qısa izah var.
- Parlaq kənarlı qara qutu:
  - faylı qutuya sürüşdürmək olar, ya da `+` düyməsi ilə seçmək olar (PDF, DOCX);
  - fayl seçiləndə kitabın adı yazılan sahə görünür;
  - **B1 / B2** səviyyə seçimi qutunun içindədir;
  - sağda ağ yuvarlaq **"yüklə"** düyməsi var.
- Qutunun ətrafında işıq zolaqları fırlanır:
  - qutuya klik edəndə və ya faylı üstünə sürüşdürəndə sürətlənir;
  - siçan yaxınlaşanda kənara çəkilir.
- Arxa fonda 3D ulduz sahəsi var, ulduzlar yavaşca sizə doğru uçur.

### Kitablarım — `library.html`
- Eyni qara, ulduzlu fon.
- Kitablar şüşə effektli kartlarda göstərilir: səviyyə, tərcümə vəziyyəti, tarix, **Oxu / Sil**.

### Oxu — `reader.html`
- Ulduzlar hərəkət etmir ki, diqqəti yayındırmasın.
- Mətn tünd paneldə, oxumaq üçün rahat şriftlə (**Literata**) göstərilir.

## Dəyişən fayllar

| Fayl | Nə dəyişdi |
|---|---|
| `js/space.js` | **Yeni.** Arxa fonu çəkən canvas: 3D ulduzlar və `data-orbit` olan elementin ətrafında fırlanan işıq axını. `<body data-space="static">` olduqda animasiya olmur. |
| `css/style.css` | Tamamilə yenidən yazıldı: yalnız tünd tema, Inter şrifti, parlaq qutu, şüşə kartlar, giriş animasiyası. |
| `index.html` | Yeni yükləmə forması (mərkəzdə başlıq + parlaq qutu). |
| `library.html` | Yeni başlıq, ulduzlu fon, şriftlər. |
| `reader.html` | Hərəkətsiz ulduzlu fon, şriftlər. |
| `js/upload.js` | İki kiçik dəyişiklik: fayl seçiləndə ad sahəsinə fokus keçir; sıfırlananda yeni placeholder mətni yazılır. |
| `CLAUDE.md` | `js/space.js` haqqında qeyd əlavə olundu. |

Yükləmə, mətnin çıxarılması, saxlanma, oxuma və silmə məntiqinə toxunulmayıb.

## Bilməli olduqlarınız

- **Yalnız tünd tema var.** Əvvəlki açıq tema artıq yoxdur, çünki videodakı dizayn tünddür.
- **Animasiyanı söndürmək:** sistemdə "hərəkəti azalt" (`prefers-reduced-motion`) ayarı açıqdırsa, animasiyalar avtomatik dayanır.
- **Şriftlər** Google Fonts-dan yüklənir. İnternet olmasa, sistem şriftləri istifadə olunur.
- **Köhnə dizaynın ehtiyat nüsxəsi** sessiyanın müvəqqəti qovluğundadır (scratchpad → `backup`) və sessiya bitəndə silinə bilər. Saxlamaq istəyirsinizsə, ayrıca qovluğa köçürmək lazımdır.
