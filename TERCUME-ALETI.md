# Word və PDF tərcümə aləti (istənilən dil → Azərbaycan)

Word (`.docx`) və PDF fayllarını **Azure Translator** ilə **Azərbaycan dilinə** tərcümə edən kiçik Node.js proqramı. Mənbə dili avtomatik tanınır. Nəticə eyni formatda qayıdır: Word faylı Word kimi, PDF faylı PDF kimi.

Fayl: `tools/translate-doc.js`. `derman-sayti` layihəsindəki alətdən köçürülüb. Orada istiqamət az → en idi, burada nəticə Azərbaycan dilindədir və PDF də PDF kimi qayıdır.

- **Word:** hər abzas tərcümə olunur. Başlıqlar, cədvəllər, şəkillər, üslublar, səhifə başlıq və altlıqları (header/footer), qeydlər (footnote) qorunur.
- **PDF:** mətn çıxarılıb abzaslara bölünür, tərcümə olunur və yeni PDF-ə yazılır. Hər orijinal səhifə yeni səhifədən başlayır. PDF-in tərtibatı (sütunlar, şəkillər, şriftlər, başlıq ölçüləri) **qorunmur**: nəticə səliqəli, sadə mətnli PDF-dir.

---

## 1. İstifadə

### Ən asan yol: faylı siçanla atmaq
Word və ya PDF faylını siçanla layihə qovluğundakı **`tercume-et.bat`** faylının üstünə atın. Qara pəncərə açılacaq, tərcümə bitəndə `Hazırdır: …` yazılacaq. Bir neçə faylı birdən atmaq da olar.

### Terminaldan
Layihə qovluğunda (`First project`):
```bash
npm run translate -- "C:\Users\ACER\Desktop\kitab.docx"
npm run translate -- "C:\Users\ACER\Desktop\kitab.pdf"
```

**Limitdən nə qədər gedəcəyini əvvəlcədən görmək üçün** (tərcümə etmir, Azure limiti xərclənmir):
```bash
npm run translate -- "C:\Users\ACER\Desktop\kitab.docx" --count
```

Faylın yolunu tez götürmək üçün: faylın üstündə `Shift` basıb sağ klik edin və **"Copy as path"** seçin.

### Nəticə orijinal faylın yanında yaranır

| Orijinal | Tərcümə |
|---|---|
| `kitab.docx` | `kitab.az.docx` |
| `kitab.pdf` | `kitab.az.pdf` |

Eyni adlı tərcümə faylı artıq varsa, üstünə yazılır.

**Nümunə çıxış:**
```
kitab.docx oxunur…
  7 abzas, 267 simvol (aylıq pulsuz limitin ~0.01%-i)
  Tərcümə olunub: 7/7 abzas
Hazırdır: C:\Users\ACER\Desktop\kitab.az.docx
```

---

## 2. Quraşdırma

Bu layihədə hər şey artıq qurulub. Yeni kompüterdə lazım olarsa:

- **Node.js 20.12 və ya daha yeni versiya** (`.env` faylını oxumaq üçün `process.loadEnvFile` lazımdır). Bu kompüterdə Node 24 var.
- Layihə qovluğunda: `npm install` (`package.json`-dakı paketləri quraşdırır).
- Layihə kökündə `.env` faylı (nümunə: `.env.example`):
  ```
  AZURE_TRANSLATOR_KEY=buraya_açar
  AZURE_TRANSLATOR_REGION=northeurope
  ```
  Açar `derman-sayti/.env` faylından köçürülüb, ikisi eyni Azure resursunu işlədir.
- PDF yaratmaq üçün Windows şrifti istifadə olunur: `arial.ttf`, olmasa `segoeui.ttf` və ya `calibri.ttf`. Hamısı Azərbaycan hərflərini (ə, ğ, ı, ş, ç, ö, ü) dəstəkləyir.

| Paket | Nə üçün |
|---|---|
| `jszip` | `.docx` faylını (əslində ZIP arxivdir) açıb yenidən yığmaq |
| `@xmldom/xmldom` | Word-ün XML faylını oxuyub dəyişmək |
| `pdf-parse` | PDF-dən mətn çıxarmaq |
| `pdfkit` | Tərcümədən yeni PDF yaratmaq |

⚠️ `.env` faylını heç kimlə paylaşmayın, internetə (GitHub və s.) yükləməyin.

---

## 3. Azure Translator məlumatları

| | |
|---|---|
| Resurs | `dermanbaza-translator` (resurs qrupu `dermanbaza-rg`) |
| Region | **North Europe** (`northeurope`) |
| Plan | **Free F0**: ayda 2 000 000 simvol (təxminən 1100 səhifə), pulsuzdur |
| Açarın yeri | Azure Portal → `dermanbaza-translator` → **Keys and Endpoint** → KEY 1 |

- Limit **DərmanBaza saytı və onun tərcümə aləti ilə ortaqdır.**
- Limit dolanda pul çıxılmır, xidmət ayın sonuna qədər dayanır.
- ⚠️ Azure-da **"Upgrade to pay-as-you-go"** düyməsinə basmayın. Bu, ödənişli plana keçid deməkdir.
- Azure-un öz **Document Translation** xidməti tərtibatı tam qoruyur (PDF də daxil), amma ödənişli **S1** planı tələb edir. F0 planında işləmir. Ona görə bu alət mətn API-si ilə işləyir.

---

## 4. Necə işləyir

### Word (`.docx`)
1. `.docx` ZIP kimi açılır. Bu XML hissələri işlənir: `word/document.xml`, `header*.xml`, `footer*.xml`, `footnotes.xml`, `endnotes.xml`.
2. Hər abzasın (`<w:p>`) öz mətn düyünləri (`<w:t>`) toplanır.
3. Abzas Azure-a HTML kimi göndərilir, hər mətn parçası `<span id="0">…</span>` içində olur. Azure tərcüməni eyni `span`-lara qaytarmağa çalışır.
4. Tərcümə orijinal `<w:t>` düyünlərinə yazılır və fayl yenidən yığılır. Üslublar, cədvəllər və şəkillərə toxunulmur.

### PDF
1. `pdf-parse` ilə səhifə-səhifə mətn çıxarılır.
2. Sətirlər abzaslara birləşdirilir. Yeni abzas bu hallarda başlayır: boş sətir, `. ! ? : ;` ilə bitən sətir, qısa sətir (başlıq və ya abzasın son sətri), siyahı bəndi (`•`, `-`, `1.`).
3. Abzaslar tərcümə olunur və `pdfkit` ilə yeni A4 PDF yaradılır. Hər orijinal səhifə yeni səhifədən başlayır. Uzun tərcümə bir səhifəyə sığmasa, növbəti səhifəyə keçir.
4. Mətni olmayan (skan edilmiş) PDF-də proqram xəta verib dayanır.

### Azure ilə iş
- Mətnlər paketlərlə göndərilir: hər sorğuda ən çox 10 000 simvol və ya 100 abzas.
- **429** (çox sorğu) cavabı gələndə proqram gözləyib 5 dəfəyə qədər yenidən cəhd edir.
- **401** açarın yanlış olduğunu, **403** isə limitin bitdiyini göstərir.
- Sonunda durğu işarəsi olmayan qısa ifadələrə müvəqqəti `.` əlavə olunur, tərcümədən sonra silinir. Azure belə ifadələri bəzən uydurur (bu, az→en istiqamətində müşahidə olunmuşdu).

---

## 5. Məhdudiyyətlər və problemlərin həlli

| Problem | Səbəb / həll |
|---|---|
| Cümlə içindəki **qalın/kursiv söz** tərcümədə adi yazılıb | Azure ingilis → Azərbaycan tərcüməsində ayrı-ayrı sözlərin formatını həmişə saxlamır (məs. qalın **Nobody** → "Heç kim" adi mətn olur). Mətn tam və düzgün qalır, yalnız həmin sözün formatı itir. Bütövlükdə qalın/kursiv abzaslar, başlıqlar və cədvəllər qorunur. |
| PDF-də tərtibat orijinaldakı kimi deyil | Gözlənilən haldır: PDF-dən yalnız mətn çıxarılır. Tərtibatı qorumaq lazımdırsa, mümkünsə faylın Word versiyasını tərcümə edin. |
| `Yalnız .docx və .pdf dəstəklənir` | Köhnə `.doc` faylıdır. Word-də **Save As → Word Document (.docx)** ilə çevirin. |
| `Bu PDF-də oxuna bilən mətn yoxdur` | PDF skan edilmiş şəkillərdən ibarətdir. Əvvəlcə OCR lazımdır, alət bunu etmir. |
| `Azure açarı yanlışdır (401)` | `.env` faylında açar səhvdir və ya boşdur. |
| `aylıq pulsuz limiti bitib (403)` | Ayda 2 milyon simvol xərclənib. Növbəti aya qədər gözləyin. |
| `AZURE_TRANSLATOR_KEY .env faylında yoxdur` | `.env` faylı layihə kökündə deyil və ya açar yazılmayıb. |
| PDF-də abzaslar səhv bölünüb | Bölmə heuristikdir, mürəkkəb tərtibatda (sütunlar, cədvəllər) səhv edə bilər. |
| Fayl artıq Azərbaycan dilindədir | Azure onu təxminən olduğu kimi qaytarır. Limit yenə də xərclənir. |
| Tərcümə süni səslənir | Maşın tərcüməsidir. Vacib sənədləri mütləq oxuyub yoxlayın. |

**Başqa hədəf dili lazım olsa:** `translate-doc.js` faylının əvvəlindəki `TO = 'az'` dəyərini dəyişin (məs. `'en'`, `'ru'`, `'tr'`). Nəticə faylının adı da ona uyğun olacaq (`kitab.en.docx`).
