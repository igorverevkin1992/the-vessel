#!/usr/bin/env python3
"""
Smart Blockbuster — Backend API Server

Запуск:
    python main.py

Сервер принимает запросы от фронтенда и вызывает Google Gemini API.
Прогресс каждого агента отображается в консоли.

Endpoints:
    POST /api/scout              -> TopicSuggestion[]
    POST /api/radar              -> { result: string }
    POST /api/analyst            -> ResearchDossier
    POST /api/architect          -> { result: string }
    POST /api/writer             -> ScriptBlock[]
    POST /api/generate-image     -> { imageUrl: string | null }
"""

import os
import sys
import json
import time
import base64
from datetime import datetime

from dotenv import load_dotenv
load_dotenv()

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn


# ═══════════════════════════════════════════════════════════════
# КОНФИГУРАЦИЯ
# ═══════════════════════════════════════════════════════════════

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
PORT = int(os.getenv("BACKEND_PORT", "8000"))

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

AGENT_MODELS = {
    "SCOUT":     "gemini-2.0-flash",
    "RADAR":     "gemini-2.0-flash",
    "ANALYST":   "gemini-2.5-flash-preview-05-20",
    "ARCHITECT": "gemini-2.0-flash",
    "WRITER":    "gemini-2.5-flash-preview-05-20",
}

IMAGE_GEN_MODEL = "gemini-2.0-flash-exp"
IMAGE_PROMPT_PREFIX = "Cinematic storyboard frame, high contrast, cyber noir documentary style. SCENE:"

RETRY_COUNT = 3
RETRY_BASE_DELAY = 1.0


# ═══════════════════════════════════════════════════════════════
# КОНСОЛЬНЫЙ ВЫВОД (цвета + время)
# ═══════════════════════════════════════════════════════════════

class C:
    CYAN    = "\033[96m"
    GREEN   = "\033[92m"
    YELLOW  = "\033[93m"
    RED     = "\033[91m"
    MAGENTA = "\033[95m"
    BLUE    = "\033[94m"
    WHITE   = "\033[97m"
    BOLD    = "\033[1m"
    DIM     = "\033[2m"
    RESET   = "\033[0m"

AGENT_COLORS = {
    "SCOUT":     C.CYAN,
    "RADAR":     C.GREEN,
    "ANALYST":   C.BLUE,
    "ARCHITECT": C.MAGENTA,
    "WRITER":    C.YELLOW,
    "SERVER":    C.DIM,
    "IMAGE":     C.WHITE,
    "ERROR":     C.RED,
}

def log(agent: str, message: str):
    ts = datetime.now().strftime("%H:%M:%S")
    color = AGENT_COLORS.get(agent, C.RESET)
    print(f"  {C.DIM}{ts}{C.RESET}  {color}{C.BOLD}[{agent}]{C.RESET}  {message}")
    sys.stdout.flush()

def log_separator(title: str = ""):
    print(f"\n  {C.DIM}{'━' * 60}{C.RESET}")
    if title:
        print(f"  {C.BOLD}{C.CYAN}{title}{C.RESET}")
        print(f"  {C.DIM}{'━' * 60}{C.RESET}")
    sys.stdout.flush()


# ═══════════════════════════════════════════════════════════════
# ПРОМПТЫ АГЕНТОВ (идентичны constants.ts)
# ═══════════════════════════════════════════════════════════════

AGENT_SCOUT_PROMPT = """
Ты — АГЕНТ СКАУТ (РАЗВЕДКА) системы «Умный Блокбастер».
Миссия: сканировать информационное поле и найти 4 темы для YouTube-видео по методологии синтеза Кэллоуэя + Харриса.

ФОКУС КАНАЛА:
- Расследования (скрытые механизмы, заговоры систем)
- Эксплейнеры (сложные объекты через простые метафоры)
- Геополитика (карты как персонажи, аномалии на границах)
- Бизнес (System Failure — когда компания = не то, чем кажется)

КРИТИЧЕСКАЯ ИНСТРУКЦИЯ — GOOGLE SEARCH:
Ты ОБЯЗАН использовать Google Search для поиска ТЕКУЩИХ новостей за последние 48 часов. НЕ предлагай общие темы. Предлагай конкретные события.

6 АРХЕТИПОВ ХУКОВ (выбери наиболее подходящий):
- Следователь ("Я нашёл документ, который от вас скрывали")
- Противник ("Это не ошибка — это умысел Системы")
- Волшебник ("Визуализация невидимого — радиация, потоки, трафик")
- Предсказатель ("Этот график 1929 года совпадает с сегодняшним")
- Экспериментатор ("Я поехал в опасное место, чтобы вам не пришлось")
- Учитель ("Как работает сложный объект — через простую метафору")

ФОРМАТ ОТВЕТА:
Верни JSON-массив из 4 объектов:
- "title": Провокационный заголовок < 60 символов
- "hook": Одно предложение — конкретное событие-триггер
- "viralFactor": Вирусный фактор (Страх/FOMO, Справедливость/Гнев, Деньги/Выгода, Секрет/Инсайд)
"""

AGENT_RADAR_PROMPT = """
Ты — АГЕНТ РАДАР системы «Умный Блокбастер».
Твоя задача: применить Дофаминовую лестницу Кэллоуэя и определить вирусные углы.

МЕТОДОЛОГИЯ — ДОФАМИНОВАЯ ЛЕСТНИЦА (6 уровней):
1. Стимуляция (0-2 сек): Визуальный шокер — остановка пальца
2. Пленение (2-10 сек): Когнитивный диссонанс, открытая петля
3. Предвкушение (основная часть): Дофамин ожидания награды
4. Валидация (закрытие петель): Ответ лучше ожидаемого
5. Симпатия: Парасоциальная связь с автором
6. Откровение: Перформативная уязвимость

ВИРУСНЫЕ ТРИГГЕРЫ:
1. Страх / FOMO ("Если вы не знаете это — вы уже проиграли")
2. Справедливость / Гнев ("Система обманывает вас — вот доказательство")
3. Деньги / Выгода ("Вот сколько вы теряете каждый день")
4. Секрет / Инсайд ("Документ, который от вас скрывали")

ФОРМАТ ОТВЕТА:
Выведи:
/// ВИРУСНЫЕ УГЛЫ
3 гипотезы видео (формат: "Если [событие], то [последствие для зрителя]")

/// ДОФАМИНОВЫЕ КРЮЧКИ
4-5 конкретных приёмов удержания

/// ЦЕЛЕВАЯ ЭМОЦИЯ
Какую эмоцию эксплуатируем и почему

/// КОНТРАРНЫЙ ОТСКОК
Формулировка "Вы думаете X, но на самом деле Y"
"""

AGENT_ANALYST_PROMPT = """
Ты — АГЕНТ АНАЛИТИК системы «Умный Блокбастер».
Цель: создать исследовательское досье по методологии Харриса (визуальная журналистика).

КРИТИЧНО: ИСПОЛЬЗУЙ GOOGLE SEARCH.
Ты ОБЯЗАН верифицировать каждое утверждение через поиск.
- НИКОГДА не говори "недавно". ГОВОРИ "14 октября 2023 года".
- НИКОГДА не говори "много денег". ГОВОРИ "$4.2 млрд".
- НИКОГДА не говори "чиновники заявили". ГОВОРИ "Джон Кирби заявил на брифинге во вторник..."

ПРОТОКОЛ ДВУХВЕКТОРНОГО ПОИСКА:
1. ОСНОВНЫЕ ИСТОЧНИКИ: мейнстрим, официальные данные, отчёты
2. АЛЬТЕРНАТИВНЫЕ ИСТОЧНИКИ: независимые расследования, утечки, контр-нарратив

ВИЗУАЛЬНЫЕ ЯКОРЯ (метод Харриса):
- НАЙДИ конкретные документы, карты, спутниковые снимки, физические локации
- НАЙДИ контрастные данные: официальная версия vs реальность
- Минимум 7 визуальных якорей

ФОРМАТ ОТВЕТА — JSON объект:
{
  "topic": "Название темы",
  "claims": ["Утверждение 1 (Источник, Дата)", "Утверждение 2..."],
  "counterClaims": ["Контр-утверждение 1 (Источник, Дата)", "..."],
  "visualAnchors": ["Документ/карта 1", "...", "...", "...", "...", "...", "Якорь 7"],
  "dataPoints": [{ "label": "Ключевая цифра", "value": "Значение" }]
}
"""

AGENT_ARCHITECT_PROMPT = """
Ты — АГЕНТ АРХИТЕКТОР системы «Умный Блокбастер».
Ты проектируешь структуру видео по формуле синтеза Кэллоуэя + Харриса.

ПРИНЦИП: "УПАКОВКА ПЕРВОЙ" (Packaging First).
Сначала проектируешь Превью и Заголовок, ПОТОМ структуру. Видео — это верификация обещания заголовка.

ШАГ 1: УПАКОВКА (Хук)
- Заголовок: < 60 символов, провокационный. Caps Lock на ключевых словах.
- Превью: "Правило левого нижнего угла". Высокий контраст. Одна точка фокуса.
- Трёхшаговый хук (3-5 секунд):
  1. Контекстное вовлечение + Визуальный якорь (кадр 0)
  2. Интервенция остановки (Scroll Stop) — паттерн-интеррапт
  3. Контрарный отскок (Curiosity Gap)

ШАГ 2: ЗУБЧАТАЯ ДУГА (12-15 минут)
- Высокий старт (00:00-01:00): Хук + Value Compression. Интенсивность 90-100%.
- Контекстный мост (01:00-03:00): Предпосылки. Интенсивность 30-40%.
- Расследование (середина): Блоки по 2-3 мин. Перезацеп каждые 2-3 мин.
- Синтез (финал): Нюансированный ответ + открытый этический вопрос.

ШАГ 3: ЦЕПОЧКА BUT/THEREFORE
Строй сценарий по принципу South Park: НО / СЛЕДОВАТЕЛЬНО вместо И ЗАТЕМ.

ФОРМАТ:
1. ПЛАН УПАКОВКИ (Заголовок, Превью, Хук)
2. СТРУКТУРНЫЙ ПЛАН (Таймкодированные блоки с описанием)
3. ЦЕПОЧКА BUT/THEREFORE
"""

AGENT_WRITER_PROMPT = """
Ты — АГЕНТ СЦЕНАРИСТ системы «Умный Блокбастер».
Пишешь финальный двухколоночный A/V сценарий по методологии синтеза Кэллоуэя + Харриса.

ЦЕЛЕВЫЕ ХАРАКТЕРИСТИКИ:
- ДЛИТЕЛЬНОСТЬ: 12-15 минут
- МИНИМУМ: 2500 СЛОВ
- МИНИМУМ: 60 БЛОКОВ (строк)

СТИЛИСТИЧЕСКИЕ ПРАВИЛА (Стаккато):
- Предложения ≤ 8 слов. Рубленый ритм.
- Коннекторы Харриса: "по сути", "честно говоря", "на самом деле", "посмотрите"
- Дейктические драйверы: указание на визуал в каждой Петле Доказательства

ПРАВИЛА ХУКА:
1. НЕТ "ПРИВЕТ": Не пиши "Привет друзья". Начинай СРАЗУ с хука.
2. НЕТ "В ЭТОМ ВИДЕО": Не объясняй что будешь делать. Просто делай.
3. ВЕДУЩИЙ = человек: уязвимый, любопытный. Риторические вопросы, паузы.
4. ИНТЕРАКТИВНОСТЬ: Попроси аудиторию комментировать/лайкнуть.
5. ТЕКСТ НА ЭКРАНЕ: Ключевые фразы должны появляться как оверлей.
6. НЕТ ДЛИННЫХ ПРОЩАНИЙ: Финал ≤ 3 секунды. Чёрный экран.

ВИЗУАЛЬНАЯ ЛОГИКА:
- Pattern Interrupts: смена типа визуала каждые 15-20 секунд
- Visual Stun Gun: неожиданный визуальный контраст
- SFX: paper rustle, whoosh, boom hit, scratch sound
- Музыка: ambient → driving beat → epic piano

ОРГАНИЧЕСКИЙ ТАЙМИНГ:
- НЕ ИСПОЛЬЗУЙ фиксированные 15-секундные блоки
- Варьируй: 3с, 45с, 12с. Постоянно меняй ритм.

ЯЗЫК:
- audioScript: АНГЛИЙСКИЙ
- russianScript: РУССКИЙ (стилистически точный перевод, не робот)
- visualCue: РУССКИЙ (для монтажёра)

ФОРМАТ — JSON массив (МИНИМУМ 60 объектов):
[
  {
    "timecode": "00:00 - 00:05",
    "visualCue": "[ВЕДУЩИЙ] Крупный план. Лицо напряжено.",
    "audioScript": "Look at this document.",
    "russianScript": "Посмотрите на этот документ.",
    "blockType": "INTRO"
  },
  ...
]
"""


# ═══════════════════════════════════════════════════════════════
# GEMINI REST API CLIENT (без SDK — работает везде)
# ═══════════════════════════════════════════════════════════════

def call_gemini(model_name: str, prompt: str, agent_name: str,
                json_mode: bool = False) -> str:
    """
    Вызов Gemini REST API с retry и логированием в консоль.
    Не использует SDK — работает через httpx напрямую.
    """
    url = f"{GEMINI_BASE_URL}/models/{model_name}:generateContent"

    body: dict = {
        "contents": [{"parts": [{"text": prompt}]}],
    }
    if json_mode:
        body["generationConfig"] = {"responseMimeType": "application/json"}

    last_error = None
    for attempt in range(RETRY_COUNT + 1):
        try:
            retry_msg = f" [попытка {attempt + 1}/{RETRY_COUNT + 1}]" if attempt > 0 else ""
            log(agent_name, f"Gemini API → {model_name}{retry_msg}")

            start = time.time()
            resp = httpx.post(
                url,
                params={"key": GEMINI_API_KEY},
                json=body,
                timeout=300.0,  # 5 минут для Writer
            )
            elapsed = time.time() - start

            if resp.status_code != 200:
                error_msg = resp.text[:300]
                raise RuntimeError(f"Gemini API {resp.status_code}: {error_msg}")

            data = resp.json()

            # Извлекаем текст из ответа
            candidates = data.get("candidates", [])
            if not candidates:
                raise ValueError("Gemini вернул пустой candidates")

            parts = candidates[0].get("content", {}).get("parts", [])
            text = ""
            for part in parts:
                if "text" in part:
                    text += part["text"]

            if not text:
                raise ValueError("Пустой текст в ответе Gemini")

            log(agent_name,
                f"{C.GREEN}✓ Ответ получен{C.RESET} ({elapsed:.1f}с, {len(text)} символов)")
            return text

        except Exception as e:
            last_error = e
            if attempt < RETRY_COUNT:
                wait = RETRY_BASE_DELAY * (2 ** attempt)
                log("ERROR", f"{agent_name}: {e}")
                log("ERROR", f"Повтор через {wait:.0f}с...")
                time.sleep(wait)
            else:
                log("ERROR", f"{agent_name}: все {RETRY_COUNT + 1} попытки исчерпаны")

    raise last_error


def call_gemini_image(prompt: str) -> str | None:
    """Генерация изображения через Gemini REST API."""
    url = f"{GEMINI_BASE_URL}/models/{IMAGE_GEN_MODEL}:generateContent"

    body = {
        "contents": [{"parts": [{"text": f"{IMAGE_PROMPT_PREFIX} {prompt}"}]}],
        "generationConfig": {
            "responseModalities": ["IMAGE", "TEXT"],
        },
    }

    try:
        resp = httpx.post(
            url,
            params={"key": GEMINI_API_KEY},
            json=body,
            timeout=60.0,
        )
        if resp.status_code != 200:
            return None

        data = resp.json()
        candidates = data.get("candidates", [])
        if not candidates:
            return None

        parts = candidates[0].get("content", {}).get("parts", [])
        for part in parts:
            inline = part.get("inlineData")
            if inline:
                mime = inline.get("mimeType", "image/png")
                b64 = inline.get("data", "")
                return f"data:{mime};base64,{b64}"

        return None
    except Exception:
        return None


# ═══════════════════════════════════════════════════════════════
# FASTAPI
# ═══════════════════════════════════════════════════════════════

app = FastAPI(title="Smart Blockbuster API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request Models ---

class RadarRequest(BaseModel):
    topic: str

class AnalystRequest(BaseModel):
    topic: str
    radarAnalysis: str

class ArchitectRequest(BaseModel):
    dossier: str

class WriterRequest(BaseModel):
    structure: str
    dossier: str

class ImageRequest(BaseModel):
    prompt: str


# --- Endpoints ---

@app.post("/api/scout")
def scout_endpoint():
    log_separator("AGENT S: SCOUT — Сканирование тем")
    log("SCOUT", "Поиск 4 тем для видео...")

    try:
        text = call_gemini(
            model_name=AGENT_MODELS["SCOUT"],
            prompt=AGENT_SCOUT_PROMPT,
            agent_name="SCOUT",
            json_mode=True,
        )
        suggestions = json.loads(text)

        log("SCOUT", f"{C.CYAN}Найдено {len(suggestions)} тем:{C.RESET}")
        for i, s in enumerate(suggestions, 1):
            log("SCOUT", f"  {i}. {s.get('title', '???')}")
            log("SCOUT", f"     Hook: {s.get('hook', '—')}")
            log("SCOUT", f"     Viral: {s.get('viralFactor', '—')}")

        return suggestions

    except Exception as e:
        log("ERROR", f"Scout провалился: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/radar")
def radar_endpoint(req: RadarRequest):
    log_separator(f"AGENT A: RADAR — «{req.topic[:50]}»")
    log("RADAR", f"Тема: {req.topic}")
    log("RADAR", "Анализ вирусных углов (Дофаминовая лестница)...")

    try:
        text = call_gemini(
            model_name=AGENT_MODELS["RADAR"],
            prompt=f"ТЕМА: {req.topic}\n\n{AGENT_RADAR_PROMPT}",
            agent_name="RADAR",
        )
        preview = text[:200].replace('\n', ' ')
        log("RADAR", f"Превью: {preview}...")
        log("RADAR", f"{C.GREEN}✓ Анализ вирусных углов завершён{C.RESET}")
        return {"result": text}

    except Exception as e:
        log("ERROR", f"Radar провалился: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analyst")
def analyst_endpoint(req: AnalystRequest):
    log_separator(f"AGENT B: ANALYST — Досье «{req.topic[:50]}»")
    log("ANALYST", f"Тема: {req.topic}")
    log("ANALYST", f"Данные Радара: {len(req.radarAnalysis)} символов")
    log("ANALYST", "Двухвекторный поиск + визуальные якоря Харриса...")

    try:
        text = call_gemini(
            model_name=AGENT_MODELS["ANALYST"],
            prompt=f"ТЕМА: {req.topic}\n\nАНАЛИЗ РАДАРА: {req.radarAnalysis}\n\n{AGENT_ANALYST_PROMPT}",
            agent_name="ANALYST",
            json_mode=True,
        )
        dossier = json.loads(text)

        log("ANALYST", f"  Утверждений:       {len(dossier.get('claims', []))}")
        log("ANALYST", f"  Контр-утверждений: {len(dossier.get('counterClaims', []))}")
        log("ANALYST", f"  Визуальных якорей: {len(dossier.get('visualAnchors', []))}")
        log("ANALYST", f"  Data points:       {len(dossier.get('dataPoints', []))}")
        log("ANALYST", f"{C.GREEN}✓ Досье скомпилировано{C.RESET}")
        return dossier

    except Exception as e:
        log("ERROR", f"Analyst провалился: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/architect")
def architect_endpoint(req: ArchitectRequest):
    log_separator("AGENT C: ARCHITECT — Структура видео")
    log("ARCHITECT", f"Входное досье: {len(req.dossier)} символов")
    log("ARCHITECT", "Проектирование Зубчатой дуги + Хук + But/Therefore...")

    try:
        text = call_gemini(
            model_name=AGENT_MODELS["ARCHITECT"],
            prompt=f"ДОСЬЕ: {req.dossier}\n\n{AGENT_ARCHITECT_PROMPT}",
            agent_name="ARCHITECT",
        )
        preview = text[:200].replace('\n', ' ')
        log("ARCHITECT", f"Превью: {preview}...")
        log("ARCHITECT", f"{C.GREEN}✓ Структура спроектирована{C.RESET}")
        return {"result": text}

    except Exception as e:
        log("ERROR", f"Architect провалился: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/writer")
def writer_endpoint(req: WriterRequest):
    log_separator("AGENT D: WRITER — Генерация A/V сценария")
    log("WRITER", f"Структура: {len(req.structure)} символов")
    log("WRITER", f"Досье: {len(req.dossier)} символов")
    log("WRITER", "Генерация 60+ блоков в стиле Стаккато...")
    log("WRITER", f"{C.DIM}(это может занять 30-120 секунд){C.RESET}")

    try:
        text = call_gemini(
            model_name=AGENT_MODELS["WRITER"],
            prompt=f"ДОСЬЕ: {req.dossier}\nСТРУКТУРА: {req.structure}\n\n{AGENT_WRITER_PROMPT}",
            agent_name="WRITER",
            json_mode=True,
        )
        script = json.loads(text)

        word_count = sum(len(b.get("audioScript", "").split()) for b in script)
        log("WRITER", f"  Блоков:    {len(script)}")
        log("WRITER", f"  Слов (EN): {word_count}")

        for i, block in enumerate(script[:3]):
            tc = block.get("timecode", "??:??")
            audio = block.get("audioScript", "")[:60]
            log("WRITER", f"  [{tc}] {audio}...")

        if len(script) > 3:
            log("WRITER", f"  ... и ещё {len(script) - 3} блоков")

        log("WRITER", f"{C.GREEN}✓ Сценарий сгенерирован!{C.RESET}")
        return script

    except Exception as e:
        log("ERROR", f"Writer провалился: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate-image")
def image_endpoint(req: ImageRequest):
    log("IMAGE", f"Генерация: {req.prompt[:60]}...")

    result = call_gemini_image(req.prompt)
    if result:
        log("IMAGE", f"{C.GREEN}✓ Изображение сгенерировано{C.RESET}")
    else:
        log("IMAGE", "Изображение не найдено в ответе")

    return {"imageUrl": result}


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "gemini_key": bool(GEMINI_API_KEY),
        "models": AGENT_MODELS,
    }


# ═══════════════════════════════════════════════════════════════
# ЗАПУСК
# ═══════════════════════════════════════════════════════════════

BANNER = f"""
{C.CYAN}{C.BOLD}  ╔═══════════════════════════════════════════════════════════╗
  ║         SMART.BLOCKBUSTER — Backend Server               ║
  ╚═══════════════════════════════════════════════════════════╝{C.RESET}

  {C.DIM}Синтез методологий Кэллоуэя + Харриса{C.RESET}

  {C.GREEN}Сервер:{C.RESET}       http://localhost:{PORT}
  {C.GREEN}API:{C.RESET}          http://localhost:{PORT}/api/*
  {C.GREEN}Health:{C.RESET}       http://localhost:{PORT}/api/health
  {C.GREEN}Gemini Key:{C.RESET}   {"✓ Установлен" if GEMINI_API_KEY else f"{C.RED}✗ НЕ УСТАНОВЛЕН! Добавьте GEMINI_API_KEY в .env{C.RESET}"}

  {C.DIM}Агенты:{C.RESET}
    {C.CYAN}[SCOUT]{C.RESET}     POST /api/scout        {C.DIM}({AGENT_MODELS['SCOUT']}){C.RESET}
    {C.GREEN}[RADAR]{C.RESET}     POST /api/radar        {C.DIM}({AGENT_MODELS['RADAR']}){C.RESET}
    {C.BLUE}[ANALYST]{C.RESET}   POST /api/analyst      {C.DIM}({AGENT_MODELS['ANALYST']}){C.RESET}
    {C.MAGENTA}[ARCHITECT]{C.RESET} POST /api/architect    {C.DIM}({AGENT_MODELS['ARCHITECT']}){C.RESET}
    {C.YELLOW}[WRITER]{C.RESET}    POST /api/writer       {C.DIM}({AGENT_MODELS['WRITER']}){C.RESET}

  {C.DIM}Запустите фронтенд: npm run dev{C.RESET}
  {C.DIM}Ожидание запросов...{C.RESET}
"""


if __name__ == "__main__":
    print(BANNER)

    if not GEMINI_API_KEY:
        print(f"\n  {C.RED}{C.BOLD}ОШИБКА: GEMINI_API_KEY не установлен!{C.RESET}")
        print(f"  Создайте файл .env в корне проекта:")
        print(f"")
        print(f"    GEMINI_API_KEY=ваш_ключ_от_google_ai_studio")
        print(f"")
        print(f"  Получить ключ: https://aistudio.google.com/apikey")
        sys.exit(1)

    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="warning")
