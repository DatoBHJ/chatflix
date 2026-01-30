// app/lib/metricTranslations.ts

type MetricKeys = 'default' | 'tps' | 'latency' | 'intelligenceIndex' | 'contextWindow';
export type TooltipKeys = Exclude<MetricKeys, 'default'>;

export type Translations = {
  names: Record<MetricKeys, string>;
  tooltips: Record<TooltipKeys, string>;
};

export const metricTranslations: Record<string, Translations> = {
  en: {
    names: {
      default: 'Default',
      tps: 'Speed',
      latency: 'Latency',
      intelligenceIndex: 'Intelligence',
      contextWindow: 'Context Window',
    },
    tooltips: {
      tps: 'Output Tokens per Second; Higher is better',
      latency: 'Seconds to First Answer Token Received; Accounts for Reasoning Model \'Thinking\' time',
      intelligenceIndex: 'Incorporates 7 evaluations: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Maximum input length the model can process - higher allows longer conversations',
    },
  },
  ko: {
    names: {
      default: '기본',
      tps: '속도',
      latency: '지연 시간',
      intelligenceIndex: '지능',
      contextWindow: '컨텍스트',
    },
    tooltips: {
      tps: '초당 출력 토큰; 높을수록 좋습니다',
      latency: '첫 답변 토큰 수신까지의 시간(초); 추론 모델의 \'사고\' 시간을 포함합니다',
      intelligenceIndex: '7가지 평가 통합: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: '모델이 처리할 수 있는 최대 입력 길이; 길수록 긴 대화가 가능합니다',
    }
  },
  ja: {
    names: {
      default: 'デフォルト',
      tps: '速度',
      latency: '遅延',
      intelligenceIndex: '知能',
      contextWindow: 'コンテキスト',
    },
    tooltips: {
      tps: '毎秒の出力トークン; 高いほど良い',
      latency: '最初の回答トークンを受信するまでの秒数; 推論モデルの「思考」時間を考慮します',
      intelligenceIndex: '7つの評価を統合: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'モデルが処理できる最大入力長; 長いほど長い会話が可能です',
    }
  },
  zh: {
    names: {
      default: '默认',
      tps: '速度',
      latency: '延迟',
      intelligenceIndex: '智能',
      contextWindow: '上下文',
    },
    tooltips: {
      tps: '每秒输出令牌; 越高越好',
      latency: '接收到第一个答案令牌的秒数; 考虑了推理模型的"思考"时间',
      intelligenceIndex: '包含7项评估：MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: '模型可以处理的最大输入长度; 越长允许更长的对话',
    }
  },
  es: {
    names: {
      default: 'Predeterminado',
      tps: 'Velocidad',
      latency: 'Latencia',
      intelligenceIndex: 'Inteligencia',
      contextWindow: 'Ventana de Contexto',
    },
    tooltips: {
      tps: 'Tokens de salida por segundo; Cuanto más alto, mejor',
      latency: 'Segundos hasta recibir el primer token de respuesta; Tiene en cuenta el tiempo de \'pensamiento\' del modelo de razonamiento',
      intelligenceIndex: 'Incorpora 7 evaluaciones: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Longitud máxima de entrada que el modelo puede procesar; cuanto más alta, permite conversaciones más largas',
    }
  },
  fr: {
    names: {
      default: 'Défaut',
      tps: 'Vitesse',
      latency: 'Latence',
      intelligenceIndex: 'Intelligence',
      contextWindow: 'Fenêtre de Contexte',
    },
    tooltips: {
      tps: 'Jetons de sortie par seconde ; Plus c\'est élevé, mieux c\'est',
      latency: 'Secondes avant la réception du premier jeton de réponse ; Prend en compte le temps de « réflexion » du modèle de raisonnement',
      intelligenceIndex: 'Incorpore 7 évaluations : MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Longueur d\'entrée maximale que le modèle peut traiter - plus elle est élevée, plus les conversations peuvent être longues',
    }
  },
  de: {
    names: {
      default: 'Standard',
      tps: 'Geschwindigkeit',
      latency: 'Latenz',
      intelligenceIndex: 'Intelligenz',
      contextWindow: 'Kontextfenster',
    },
    tooltips: {
      tps: 'Ausgabetoken pro Sekunde; Höher ist besser',
      latency: 'Sekunden bis zum Empfang des ersten Antworttokens; Berücksichtigt die "Denkzeit" des Reasoning-Modells',
      intelligenceIndex: 'Beinhaltet 7 Bewertungen: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Maximale Eingabelänge, die das Modell verarbeiten kann – je höher, desto längere Gespräche sind möglich',
    }
  },
  ru: {
    names: {
      default: 'По умолчанию',
      tps: 'Скорость',
      latency: 'Задержка',
      intelligenceIndex: 'Интеллект',
      contextWindow: 'Контекстное окно',
    },
    tooltips: {
      tps: 'Выходные токены в секунду; Чем выше, тем лучше',
      latency: 'Секунды до получения первого ответного токена; Учитывается время "обдумывания" модели рассуждения',
      intelligenceIndex: 'Включает 7 оценок: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Максимальная длина ввода, которую может обработать модель — чем выше, тем длиннее могут быть разговоры',
    }
  },
  pt: {
    names: {
      default: 'Padrão',
      tps: 'Velocidade',
      latency: 'Latência',
      intelligenceIndex: 'Inteligência',
      contextWindow: 'Janela de Contexto',
    },
    tooltips: {
      tps: 'Tokens de saída por segundo; Quanto maior, melhor',
      latency: 'Segundos até o primeiro token de resposta recebido; Leva em conta o tempo de \'pensamento\' do modelo de raciocínio',
      intelligenceIndex: 'Incorpora 7 avaliações: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Comprimento máximo de entrada que o modelo pode processar - quanto maior, permite conversas mais longas',
    }
  },
  it: {
    names: {
      default: 'Predefinito',
      tps: 'Velocità',
      latency: 'Latenza',
      intelligenceIndex: 'Intelligenza',
      contextWindow: 'Finestra di Contesto',
    },
    tooltips: {
      tps: 'Token di output al secondo; Più alto è, meglio è',
      latency: 'Secondi al primo token di risposta ricevuto; Tiene conto del tempo di "pensiero" del modello di ragionamento',
      intelligenceIndex: 'Incorpora 7 valutazioni: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Lunghezza massima dell\'input che il modello può elaborare: più è alta, più lunghe sono le conversazioni consentite',
    }
  },
  ar: {
    names: {
      default: 'الافتراضي',
      tps: 'السرعة',
      latency: 'الكمون',
      intelligenceIndex: 'الذكاء',
      contextWindow: 'نافذة السياق',
    },
    tooltips: {
      tps: 'رموز الإخراج في الثانية ؛ كلما كان أعلى كان أفضل',
      latency: 'الثواني حتى استلام أول رمز مميز للإجابة ؛ يأخذ في الاعتبار وقت "التفكير" لنموذج التفكير',
      intelligenceIndex: 'يتضمن 7 تقييمات: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'أقصى طول إدخال يمكن للنموذج معالجته - كلما كان أعلى ، يسمح بإجراء محادثات أطول',
    }
  },
  hi: {
    names: {
      default: 'डिफ़ॉल्ट',
      tps: 'गति',
      latency: 'विलंबता',
      intelligenceIndex: 'बुद्धि',
      contextWindow: 'संदर्भ विंडो',
    },
    tooltips: {
      tps: 'आउटपुट टोकन प्रति सेकंड; जितना अधिक उतना बेहतर',
      latency: 'पहला उत्तर टोकन प्राप्त होने तक सेकंड; रीजनिंग मॉडल के \'सोचने\' के समय का हिसाब रखता है',
      intelligenceIndex: '7 मूल्यांकन शामिल हैं: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'अधिकतम इनपुट लंबाई जिसे मॉडल संसाधित कर सकता है - जितनी अधिक होगी, उतनी लंबी बातचीत की अनुमति होगी',
    }
  },
  th: {
    names: {
      default: 'ค่าเริ่มต้น',
      tps: 'ความเร็ว',
      latency: 'ความหน่วง',
      intelligenceIndex: 'หน่วยสืบราชการลับ',
      contextWindow: 'หน้าต่างบริบท',
    },
    tooltips: {
      tps: 'โทเค็นเอาต์พุตต่อวินาที ยิ่งสูงยิ่งดี',
      latency: 'วินาทีกว่าจะได้รับโทเค็นคำตอบแรก คำนึงถึงเวลา \'คิด\' ของโมเดลการให้เหตุผล',
      intelligenceIndex: 'ประกอบด้วยการประเมิน 7 รายการ: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'ความยาวอินพุตสูงสุดที่โมเดลสามารถประมวลผลได้ ยิ่งสูงยิ่งอนุญาตให้สนทนาได้นานขึ้น',
    }
  },
  vi: {
    names: {
      default: 'Mặc định',
      tps: 'Tốc độ',
      latency: 'Độ trễ',
      intelligenceIndex: 'Sự thông minh',
      contextWindow: 'Cửa sổ ngữ cảnh',
    },
    tooltips: {
      tps: 'Số token đầu ra mỗi giây; Càng cao càng tốt',
      latency: 'Số giây cho đến khi nhận được token trả lời đầu tiên; Tính đến thời gian \'suy nghĩ\' của mô hình lý luận',
      intelligenceIndex: 'Kết hợp 7 bài đánh giá: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Độ dài đầu vào tối đa mà mô hình có thể xử lý - càng cao cho phép các cuộc hội thoại dài hơn',
    }
  },
  nl: {
    names: {
      default: 'Standaard',
      tps: 'Snelheid',
      latency: 'Latentie',
      intelligenceIndex: 'Intelligentie',
      contextWindow: 'Contextvenster',
    },
    tooltips: {
      tps: 'Output-tokens per seconde; Hoger is beter',
      latency: 'Seconden tot eerste antwoordtoken ontvangen; Houdt rekening met de \'denktijd\' van het redeneermodel',
      intelligenceIndex: 'Bevat 7 evaluaties: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Maximale invoerlengte die het model kan verwerken - hoe hoger, hoe langer de gesprekken kunnen zijn',
    }
  },
  sv: {
    names: {
      default: 'Standard',
      tps: 'Hastighet',
      latency: 'Latens',
      intelligenceIndex: 'Intelligens',
      contextWindow: 'Kontextfönster',
    },
    tooltips: {
      tps: 'Utdata-tokens per sekund; Högre är bättre',
      latency: 'Sekunder till första svarstoken mottagen; Tar hänsyn till resonemangsmodellens "tänketid"',
      intelligenceIndex: 'Innehåller 7 utvärderingar: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Maximal inmatningslängd som modellen kan bearbeta - högre tillåter längre konversationer',
    }
  },
  da: {
    names: {
      default: 'Standard',
      tps: 'Hastighed',
      latency: 'Latens',
      intelligenceIndex: 'Intelligens',
      contextWindow: 'Kontekstvindue',
    },
    tooltips: {
      tps: 'Output-tokens pr. sekund; Højere er bedre',
      latency: 'Sekunder til første svar-token modtaget; Tager højde for ræsonnementsmodellens \'tænketid\'',
      intelligenceIndex: 'Inkorporerer 7 evalueringer: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Maksimal inputlængde, som modellen kan behandle - højere tillader længere samtaler',
    }
  },
  no: {
    names: {
      default: 'Standard',
      tps: 'Hastighet',
      latency: 'Forsinkelse',
      intelligenceIndex: 'Intelligens',
      contextWindow: 'Kontekstvindu',
    },
    tooltips: {
      tps: 'Utdata-tokens per sekund; Høyere er bedre',
      latency: 'Sekunder til første svar-token mottatt; Tar hensyn til resonneringsmodellens "tenketid"',
      intelligenceIndex: 'Inneholder 7 evalueringer: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Maksimal inndatalengde modellen kan behandle - høyere tillater lengre samtaler',
    }
  },
  fi: {
    names: {
      default: 'Oletus',
      tps: 'Nopeus',
      latency: 'Latenssi',
      intelligenceIndex: 'Älykkyys',
      contextWindow: 'Konteksti-ikkuna',
    },
    tooltips: {
      tps: 'Tulostokenit sekunnissa; Korkeampi on parempi',
      latency: 'Sekunnit ensimmäisen vastauksen tokenin vastaanottamiseen; Ottaa huomioon päättelymallin "ajatteluajan"',
      intelligenceIndex: 'Sisältää 7 arviointia: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Mallin käsittelemä enimmäissyötteen pituus - mitä suurempi, sitä pidempiä keskusteluja sallitaan',
    }
  },
  pl: {
    names: {
      default: 'Domyślny',
      tps: 'Prędkość',
      latency: 'Opóźnienie',
      intelligenceIndex: 'Inteligencja',
      contextWindow: 'Okno kontekstowe',
    },
    tooltips: {
      tps: 'Tokeny wyjściowe na sekundę; Im wyższa, tym lepsza',
      latency: 'Sekundy do otrzymania pierwszego tokenu odpowiedzi; Uwzględnia czas "myślenia" modelu rozumowania',
      intelligenceIndex: 'Obejmuje 7 ocen: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Maksymalna długość danych wejściowych, jaką model może przetworzyć — im większa, tym dłuższe rozmowy są dozwolone',
    }
  },
  tr: {
    names: {
      default: 'Varsayılan',
      tps: 'Hız',
      latency: 'Gecikme',
      intelligenceIndex: 'Zeka',
      contextWindow: 'Bağlam Penceresi',
    },
    tooltips: {
      tps: 'Saniyedeki Çıktı Belirteçleri; Daha Yüksek Daha İyidir',
      latency: 'İlk Yanıt Belirtecinin Alınmasına Kadar Geçen Saniye; Muhakeme Modelinin \'Düşünme\' Süresini Hesaba Katar',
      intelligenceIndex: '7 değerlendirme içerir: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Modelin işleyebileceği maksimum giriş uzunluğu - ne kadar yüksek olursa o kadar uzun konuşmalara izin verir',
    }
  },
  he: {
    names: {
      default: 'ברירת מחדל',
      tps: 'מהירות',
      latency: 'חביון',
      intelligenceIndex: 'אינטליגנציה',
      contextWindow: 'חלון הקשר',
    },
    tooltips: {
      tps: 'אסימוני פלט לשנייה; גבוה יותר טוב יותר',
      latency: 'שניות עד לקבלת אסימון התשובה הראשון; לוקח בחשבון את זמן ה\'חשיבה\' של מודל ההיגיון',
      intelligenceIndex: 'משלב 7 הערכות: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'אורך קלט מרבי שהמודל יכול לעבד - ככל שהוא גבוה יותר, כך מתאפשרות שיחות ארוכות יותר',
    }
  },
  uk: {
    names: {
      default: 'За замовчуванням',
      tps: 'Швидкість',
      latency: 'Затримка',
      intelligenceIndex: 'Інтелект',
      contextWindow: 'Контекстне вікно',
    },
    tooltips: {
      tps: 'Вихідні токени за секунду; Чим вище, тим краще',
      latency: 'Секунди до отримання першого токена відповіді; Враховує час «мислення» моделі міркування',
      intelligenceIndex: 'Включає 7 оцінок: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Максимальна довжина вводу, яку може обробити модель — чим вище, тим довші розмови дозволяються',
    }
  },
  cs: {
    names: {
      default: 'Výchozí',
      tps: 'Rychlost',
      latency: 'Latence',
      intelligenceIndex: 'Inteligence',
      contextWindow: 'Kontextové okno',
    },
    tooltips: {
      tps: 'Výstupní tokeny za sekundu; Čím vyšší, tím lepší',
      latency: 'Sekundy do přijetí prvního tokenu odpovědi; Započítává dobu "přemýšlení" modelu uvažování',
      intelligenceIndex: 'Zahrnuje 7 hodnocení: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Maximální délka vstupu, kterou může model zpracovat – čím vyšší, tím delší konverzace jsou povoleny',
    }
  },
  hu: {
    names: {
      default: 'Alapértelmezett',
      tps: 'Sebesség',
      latency: 'Késleltetés',
      intelligenceIndex: 'Intelligencia',
      contextWindow: 'Kontextus ablak',
    },
    tooltips: {
      tps: 'Kimeneti tokenek másodpercenként; Minél magasabb, annál jobb',
      latency: 'Másodpercek az első választoken megérkezéséig; Figyelembe veszi az érvelési modell "gondolkodási" idejét',
      intelligenceIndex: '7 értékelést tartalmaz: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'A modell által feldolgozható maximális bemeneti hossz – minél nagyobb, annál hosszabb beszélgetéseket tesz lehetővé',
    }
  },
  ro: {
    names: {
      default: 'Mod implicit',
      tps: 'Viteză',
      latency: 'Latență',
      intelligenceIndex: 'Inteligență',
      contextWindow: 'Fereastră de context',
    },
    tooltips: {
      tps: 'Tokeni de ieșire pe secundă; Mai mare este mai bine',
      latency: 'Secunde până la primirea primului token de răspuns; Ține cont de timpul de "gândire" al modelului de raționament',
      intelligenceIndex: 'Încorporează 7 evaluări: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Lungimea maximă de intrare pe care o poate procesa modelul - cu cât este mai mare, cu atât permite conversații mai lungi',
    }
  },
  bg: {
    names: {
      default: 'По подразбиране',
      tps: 'Скорост',
      latency: 'Закъснение',
      intelligenceIndex: 'Интелигентност',
      contextWindow: 'Контекстен прозорец',
    },
    tooltips: {
      tps: 'Изходни токени в секунда; Колкото по-високо, толкова по-добре',
      latency: 'Секунди до получаване на първия токен за отговор; Отчита времето за "мислене" на модела за разсъждение',
      intelligenceIndex: 'Включва 7 оценки: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Максимална дължина на въвеждане, която моделът може да обработи – колкото по-голяма, толкова по-дълги разговори позволява',
    }
  },
  hr: {
    names: {
      default: 'Zadano',
      tps: 'Brzina',
      latency: 'Latencija',
      intelligenceIndex: 'Inteligencija',
      contextWindow: 'Kontekstni prozor',
    },
    tooltips: {
      tps: 'Izlazni tokeni u sekundi; Što više to bolje',
      latency: 'Sekunde do primljenog prvog tokena odgovora; Uzima u obzir vrijeme \'razmišljanja\' modela rasuđivanja',
      intelligenceIndex: 'Uključuje 7 ocjena: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Maksimalna duljina unosa koju model može obraditi - što je veća, omogućuje duže razgovore',
    }
  },
  sk: {
    names: {
      default: 'Predvolené',
      tps: 'Rýchlosť',
      latency: 'Latencia',
      intelligenceIndex: 'Inteligencia',
      contextWindow: 'Kontextové okno',
    },
    tooltips: {
      tps: 'Výstupné tokeny za sekundu; Čím vyššie, tým lepšie',
      latency: 'Sekundy do prijatia prvého tokenu odpovede; Zohľadňuje čas "myslenia" modelu uvažovania',
      intelligenceIndex: 'Zahŕňa 7 hodnotení: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Maximálna dĺžka vstupu, ktorú môže model spracovať – čím vyššia, tým dlhšie konverzácie sú povolené',
    }
  },
  sl: {
    names: {
      default: 'Privzeto',
      tps: 'Hitrost',
      latency: 'Zakasnitev',
      intelligenceIndex: 'Inteligenca',
      contextWindow: 'Kontekstno okno',
    },
    tooltips: {
      tps: 'Izhodni žetoni na sekundo; Višje je boljše',
      latency: 'Sekunde do prejetega prvega žetona z odgovorom; Upošteva čas "razmišljanja" modela za sklepanje',
      intelligenceIndex: 'Vključuje 7 ocen: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Največja dolžina vnosa, ki jo model lahko obdela – višja omogoča daljše pogovore',
    }
  },
  et: {
    names: {
      default: 'Vaikimisi',
      tps: 'Kiirus',
      latency: 'Latentsus',
      intelligenceIndex: 'Intelligentsus',
      contextWindow: 'Kontekstiaken',
    },
    tooltips: {
      tps: 'Väljundmärgid sekundis; Mida kõrgem, seda parem',
      latency: 'Sekundid esimese vastusemärgi saamiseni; Arvestab arutlusmudeli "mõtlemisaega"',
      intelligenceIndex: 'Sisaldab 7 hindamist: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Maksimaalne sisendi pikkus, mida mudel suudab töödelda – mida suurem, seda pikemaid vestlusi lubatakse',
    }
  },
  lv: {
    names: {
      default: 'Noklusējums',
      tps: 'Ātrums',
      latency: 'Latentums',
      intelligenceIndex: 'Intelekts',
      contextWindow: 'Konteksta logs',
    },
    tooltips: {
      tps: 'Izvades marķieri sekundē; Jo augstāks, jo labāk',
      latency: 'Sekundes līdz saņemts pirmais atbildes marķieris; Ņem vērā spriešanas modeļa "domāšanas" laiku',
      intelligenceIndex: 'Ietver 7 novērtējumus: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Maksimālais ievades garums, ko modelis var apstrādāt — jo lielāks, jo garākas sarunas ir atļautas',
    }
  },
  lt: {
    names: {
      default: 'Numatytas',
      tps: 'Greitis',
      latency: 'Uždelsimas',
      intelligenceIndex: 'Intelektas',
      contextWindow: 'Konteksto langas',
    },
    tooltips: {
      tps: 'Išvesties žetonai per sekundę; Kuo aukštesnis, tuo geriau',
      latency: 'Sekundės iki pirmojo atsakymo žetono gavimo; Atsižvelgiama į samprotavimo modelio "mąstymo" laiką',
      intelligenceIndex: 'Apima 7 vertinimus: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Maksimalus įvesties ilgis, kurį modelis gali apdoroti – kuo ilgesnis, tuo ilgesni pokalbiai leidžiami',
    }
  },
  mt: {
    names: {
      default: 'Default',
      tps: 'Veloċità',
      latency: 'Latenza',
      intelligenceIndex: 'Intelliġenza',
      contextWindow: 'Tieqa tal-Kuntest',
    },
    tooltips: {
      tps: 'Tokens tal-Output kull Sekonda; Iktar ma jkun għoli aħjar',
      latency: 'Sekondi għall-Ewwel Token ta\' Risposta Riċevut; Jikkunsidra l-ħin ta\' \'Ħsieb\' tal-Mudell ta\' Raġunament',
      intelligenceIndex: 'Jinkorpora 7 evalwazzjonijiet: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Tul massimu tal-input li l-mudell jista\' jipproċessa - iktar ma jkun għoli jippermetti konversazzjonijiet itwal',
    }
  },
  is: {
    names: {
      default: 'Sjálfgefið',
      tps: 'Hraði',
      latency: 'Leynd',
      intelligenceIndex: 'Gáfur',
      contextWindow: 'Samhengisgluggi',
    },
    tooltips: {
      tps: 'Úttakstákn á sekúndu; Hærra er betra',
      latency: 'Sekúndur þar til fyrsta svarstáknið er móttekið; Tekur mið af "hugsunartíma" rökhugsunarlíkansins',
      intelligenceIndex: 'Inniheldur 7 úttektir: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Hámarkslengd innsláttar sem líkanið getur unnið úr - hærri leyfir lengri samtöl',
    }
  },
  ga: {
    names: {
      default: 'Réamhshocrú',
      tps: 'Luas',
      latency: 'Folaigh',
      intelligenceIndex: 'Faisnéis',
      contextWindow: 'Fuinneog Comhthéacs',
    },
    tooltips: {
      tps: 'Comharthaí Aschuir in aghaidh an tSoicind; Dá airde is amhlaidh is fearr',
      latency: 'Soicind go dtí an Chéad Chomhartha Freagartha a Fuarthas; Cuireann sé am \'Smaointeoireachta\' an Mhúnla Réasúnaíochta san áireamh',
      intelligenceIndex: 'Ionchorpraíonn sé 7 meastóireacht: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Uasfhad ionchuir ar féidir leis an tsamhail a phróiseáil - ceadaíonn ceann níos airde comhráite níos faide',
    }
  },
  cy: {
    names: {
      default: 'Diofyn',
      tps: 'Cyflymder',
      latency: 'Cudd-dra',
      intelligenceIndex: 'Deallusrwydd',
      contextWindow: 'Ffenestr Gyd-destun',
    },
    tooltips: {
      tps: 'Tocynnau Allbwn yr Eiliad; Mae Uwch yn Well',
      latency: 'Eiliadau i\'r Tocyn Ateb Cyntaf a Dderbyniwyd; Yn cyfrif am amser \'Meddwl\' y Model Rhesymu',
      intelligenceIndex: 'Yn ymgorffori 7 gwerthusiad: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Uchafswm hyd mewnbwn y gall y model ei brosesu - mae uwch yn caniatáu sgyrsiau hirach',
    }
  },
  eu: {
    names: {
      default: 'Lehenetsia',
      tps: 'Abiadura',
      latency: 'Latenzia',
      intelligenceIndex: 'Adimena',
      contextWindow: 'Testuinguruaren leihoa',
    },
    tooltips: {
      tps: 'Irteerako tokenak segundoko; Zenbat eta handiagoa, orduan eta hobeto',
      latency: 'Lehen erantzunaren tokena jaso arteko segundoak; Arrazoiketa-ereduaren "pentsatzeko" denbora kontuan hartzen du',
      intelligenceIndex: '7 ebaluazio biltzen ditu: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Modeloak prozesa dezakeen sarrerako gehienezko luzera; handiagoak elkarrizketa luzeagoak ahalbidetzen ditu',
    }
  },
  ca: {
    names: {
      default: 'Per defecte',
      tps: 'Velocitat',
      latency: 'Latència',
      intelligenceIndex: 'Intel·ligència',
      contextWindow: 'Finestra de Context',
    },
    tooltips: {
      tps: 'Tokens de sortida per segon; Com més alt, millor',
      latency: 'Segons fins a rebre el primer testimoni de resposta; Té en compte el temps de "pensament" del model de raonament',
      intelligenceIndex: 'Incorpora 7 avaluacions: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Longitud màxima d\'entrada que pot processar el model: com més alta, permet converses més llargues',
    }
  },
  gl: {
    names: {
      default: 'Predeterminado',
      tps: 'Velocidade',
      latency: 'Latencia',
      intelligenceIndex: 'Intelixencia',
      contextWindow: 'Xanela de Contexto',
    },
    tooltips: {
      tps: 'Fichas de saída por segundo; Canto maior, mellor',
      latency: 'Segundos ata a primeira ficha de resposta recibida; Ten en conta o tempo de "pensamento" do modelo de razoamento',
      intelligenceIndex: 'Incorpora 7 avaliacións: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: 'Lonxitude máxima de entrada que pode procesar o modelo; canto maior, permite conversas máis longas',
    }
  }
};

/**
 * Get current language code
 */
function getCurrentLanguageCode(): string {
  if (typeof navigator === 'undefined') {
    return 'en';
  }
  const userLang = navigator.language.toLowerCase();
  return userLang.split('-')[0] || 'en';
}

// Convert metricTranslations to the expected format for getMetricTranslationsForUser
function convertMetricTranslationsForUser() {
  const result: Record<string, Record<string, string>> = {};
  const languages = Object.keys(metricTranslations) as string[];
  
  // Process names
  for (const lang of languages) {
    const metricData = metricTranslations[lang];
    if (metricData && metricData.names) {
      const names = metricData.names as Record<string, string>;
      for (const key in names) {
        if (Object.prototype.hasOwnProperty.call(names, key)) {
          if (!result[key]) {
            result[key] = {};
          }
          result[key][lang] = names[key];
        }
      }
    }
  }
  
  // Process tooltips with 'tooltip_' prefix
  for (const lang of languages) {
    const metricData = metricTranslations[lang];
    if (metricData && metricData.tooltips) {
      const tooltips = metricData.tooltips as Record<string, string>;
      for (const key in tooltips) {
        if (Object.prototype.hasOwnProperty.call(tooltips, key)) {
          const tooltipKey = `tooltip_${key}`;
          if (!result[tooltipKey]) {
            result[tooltipKey] = {};
          }
          result[tooltipKey][lang] = tooltips[key];
        }
      }
    }
  }
  
  return result;
}

/**
 * Get metric translations using centralized i18n system
 * This is a wrapper function for backward compatibility
 */
export function getMetricTranslationsForUser(userLang?: string): Translations {
  // Use language detection
  const langCode = userLang || getCurrentLanguageCode();
  
  // Convert metric translations
  const convertedMetricTranslations = convertMetricTranslationsForUser();
  const metricData = convertedMetricTranslations;
  
  // Convert back to the expected format
  const result: Translations = {
    names: {
      default: metricData.default?.[langCode] || metricData.default?.['en'] || 'Default',
      tps: metricData.tps?.[langCode] || metricData.tps?.['en'] || 'Speed',
      latency: metricData.latency?.[langCode] || metricData.latency?.['en'] || 'Latency',
      intelligenceIndex: metricData.intelligenceIndex?.[langCode] || metricData.intelligenceIndex?.['en'] || 'Intelligence',
      contextWindow: metricData.contextWindow?.[langCode] || metricData.contextWindow?.['en'] || 'Context Window',
    },
    tooltips: {
      tps: metricData.tooltip_tps?.[langCode] || metricData.tooltip_tps?.['en'] || 'Output Tokens per Second; Higher is better',
      latency: metricData.tooltip_latency?.[langCode] || metricData.tooltip_latency?.['en'] || 'Seconds to First Answer Token Received; Accounts for Reasoning Model \'Thinking\' time',
      intelligenceIndex: metricData.tooltip_intelligenceIndex?.[langCode] || metricData.tooltip_intelligenceIndex?.['en'] || 'Incorporates 7 evaluations: MMLU-Pro, GPQA Diamond, Humanity\'s Last Exam, LiveCodeBench, SciCode, AIME, MATH-500',
      contextWindow: metricData.tooltip_contextWindow?.[langCode] || metricData.tooltip_contextWindow?.['en'] || 'Maximum input length the model can process - higher allows longer conversations',
    }
  };
  
  return result;
} 