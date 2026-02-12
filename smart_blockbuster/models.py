"""
Модели данных для архитектуры «Умного блокбастера».

Реализует структуры из PDF:
- Дофаминовая лестница (6 уровней)
- Архетипы хуков (6 типов)
- Петля доказательства (Evidence Loop)
- Зубчатая дуга (Serrated Edge)
- A/V сценарий
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


# ---------------------------------------------------------------------------
# Часть 2. Дофаминовая лестница (The Dopamine Ladder)
# ---------------------------------------------------------------------------

class DopamineLevel(Enum):
    """Шестиступенчатая модель пути зрителя от безразличия к фанатизму."""

    STIMULATION = 1      # 0-2 сек: Визуальный шокер
    CAPTIVATION = 2      # 2-10 сек: Когнитивный диссонанс / Открытая петля
    ANTICIPATION = 3     # Основная часть: Предвкушение (Predictive Coding)
    VALIDATION = 4       # Закрытие петель: Ответ на вопрос
    AFFECTION = 5        # Симпатия: Парасоциальная связь
    REVELATION = 6       # Откровение: Перформативная уязвимость

    @property
    def description_ru(self) -> str:
        descriptions = {
            1: "Стимуляция (0–2 сек): Визуальный шокер — остановка пальца",
            2: "Пленение (2–10 сек): Когнитивный диссонанс, Открытая петля",
            3: "Предвкушение (основная часть): Дофамин ожидания награды",
            4: "Валидация (закрытие петель): Ответ лучше ожидаемого",
            5: "Симпатия: Переход к потреблению личности автора",
            6: "Откровение: Перформативная уязвимость, парасоциальная связь",
        }
        return descriptions[self.value]


# ---------------------------------------------------------------------------
# Часть 3. Архетипы хуков
# ---------------------------------------------------------------------------

class HookArchetype(Enum):
    """Шесть архетипов хуков по Кэллоуэю, адаптированных для «Умного блокбастера»."""

    INVESTIGATOR = "investigator"   # Следователь
    CONTRARIAN = "contrarian"       # Противник
    MAGICIAN = "magician"           # Волшебник
    FORTUNE_TELLER = "fortune_teller"  # Предсказатель
    EXPERIMENTER = "experimenter"   # Экспериментатор
    TEACHER = "teacher"             # Учитель


# Метаданные архетипов: триггер, адаптация для «Умного блокбастера»
HOOK_ARCHETYPE_META: dict[str, dict[str, str]] = {
    HookArchetype.INVESTIGATOR.value: {
        "name_ru": "Следователь (The Investigator)",
        "trigger": "Секретность / Инсайд",
        "adaptation": (
            "«The Leak»: Я нашёл документ/карту, которую от вас скрывали. "
            "Акцент на физическом носителе информации (Paper trail)."
        ),
    },
    HookArchetype.CONTRARIAN.value: {
        "name_ru": "Противник (The Contrarian)",
        "trigger": "Когнитивный диссонанс",
        "adaptation": (
            "«System Failure»: Это не ошибка человека, это злой умысел Системы. "
            "«Вы думаете, Макдоналдс не может починить машины? Нет, они не хотят»."
        ),
    },
    HookArchetype.MAGICIAN.value: {
        "name_ru": "Волшебник (The Magician)",
        "trigger": "Сенсорный шок",
        "adaptation": (
            "«Data Vis»: Визуализация невидимого. Радиация, денежные потоки или "
            "интернет-трафик, показанные как физическая субстанция на карте."
        ),
    },
    HookArchetype.FORTUNE_TELLER.value: {
        "name_ru": "Предсказатель (The Fortune Teller)",
        "trigger": "FOMO / Страх будущего",
        "adaptation": (
            "«Historical Echo»: Проекция прошлого на будущее. "
            "«Этот график 1929 года полностью совпадает с сегодняшним днём»."
        ),
    },
    HookArchetype.EXPERIMENTER.value: {
        "name_ru": "Экспериментатор (The Experimenter)",
        "trigger": "Викарное научение",
        "adaptation": (
            "«Field Trip»: Я поехал в опасное место / попробовал запрещённое, "
            "чтобы вам не пришлось. Эффект присутствия."
        ),
    },
    HookArchetype.TEACHER.value: {
        "name_ru": "Учитель (The Teacher)",
        "trigger": "Авторитет / Мудрость",
        "adaptation": (
            "«Hidden Mechanism»: Объяснение того, как работает сложный объект "
            "(логистика, чип), через простую метафору."
        ),
    },
}


# ---------------------------------------------------------------------------
# Часть 3. Инженерная архитектура хука
# ---------------------------------------------------------------------------

@dataclass
class HookStep:
    """Один шаг из трёхшаговой формулы хука."""
    name: str
    goal: str
    text: str
    visual: str = ""


@dataclass
class Hook:
    """
    Хук — автономная инженерная конструкция (3–5 секунд).

    Трёхшаговая формула синтеза:
      1. Контекстное вовлечение через Якорь (Context Lean-in + Anchor)
      2. Интервенция остановки (Scroll Stop Interjection)
      3. Контрарный отскок (Contrarian Snapback)
    """

    archetype: HookArchetype
    step1_anchor: HookStep       # Контекстное вовлечение + Визуальный якорь
    step2_interjection: HookStep  # Паттерн-интеррапт
    step3_snapback: HookStep     # Контрарный отскок / Curiosity Gap

    def steps(self) -> list[HookStep]:
        return [self.step1_anchor, self.step2_interjection, self.step3_snapback]


# ---------------------------------------------------------------------------
# Часть 3.3. Чек-лист валидации хука (4 «Всадника Апокалипсиса»)
# ---------------------------------------------------------------------------

class HookError(Enum):
    """Четыре ошибки хука — «Всадники Апокалипсиса» по Кэллоуэю."""

    DELAY = "delay"
    CONFUSION = "confusion"
    IRRELEVANCE = "irrelevance"
    DISINTEREST = "disinterest"


HOOK_ERROR_CHECKS: dict[str, dict[str, str]] = {
    HookError.DELAY.value: {
        "name_ru": "Задержка (Delay)",
        "question": "Якорь показан в кадре 0? Если нет — переписать.",
    },
    HookError.CONFUSION.value: {
        "name_ru": "Замешательство (Confusion)",
        "question": (
            "Используются ли слова из 6-го класса? "
            "Соответствует ли картинка слову (Visual Matching)?"
        ),
    },
    HookError.IRRELEVANCE.value: {
        "name_ru": "Нерелевантность (Irrelevance)",
        "question": (
            "Отвечает ли хук на вопрос «Как это касается лично меня (зрителя)?». "
            "Используется ли местоимение «Вы» (Audience of One)?"
        ),
    },
    HookError.DISINTEREST.value: {
        "name_ru": "Скука (Disinterest)",
        "question": "Достаточно ли высоки ставки? Есть ли конфликт?",
    },
}


# ---------------------------------------------------------------------------
# Часть 4. Сценарная структура
# ---------------------------------------------------------------------------

class SerratedPhase(Enum):
    """Фазы Зубчатой дуги (The Serrated Edge)."""

    HIGH_START = "high_start"         # 00:00–01:00, интенсивность 90-100%
    CONTEXT_BRIDGE = "context_bridge" # 01:00–03:00, интенсивность 30-40%
    REHOOK = "rehook"                 # каждые 2-3 мин, скачок до 80%
    INVESTIGATION = "investigation"   # середина, Forward Motion
    SYNTHESIS = "synthesis"           # финал, Payoff


SERRATED_PHASE_META: dict[str, dict] = {
    SerratedPhase.HIGH_START.value: {
        "name_ru": "Высокий старт",
        "timecode": "00:00 – 01:00",
        "intensity_pct": (90, 100),
        "goal": "Хук + Сжатие ценности (Value Compression). Сразу в гущу событий.",
    },
    SerratedPhase.CONTEXT_BRIDGE.value: {
        "name_ru": "Контекстный мост",
        "timecode": "01:00 – 03:00",
        "intensity_pct": (30, 40),
        "goal": (
            "Выдохнуть и объяснить предпосылки (Zoom Out). "
            "Максимально сжат — никакой «воды». Каждое предложение строит мост."
        ),
    },
    SerratedPhase.REHOOK.value: {
        "name_ru": "Перезацеп (Re-hooking)",
        "timecode": "Каждые 2–3 минуты",
        "intensity_pct": (70, 80),
        "goal": "Обнулить таймер внимания. Ввести новый конфликт.",
    },
    SerratedPhase.INVESTIGATION.value: {
        "name_ru": "Расследование и Эксперимент",
        "timecode": "Середина",
        "intensity_pct": (50, 70),
        "goal": (
            "Forward Motion. Чередование кабинетного анализа "
            "(карты, документы) и полевого экшена (звонки, поездки)."
        ),
    },
    SerratedPhase.SYNTHESIS.value: {
        "name_ru": "Синтез (Финал)",
        "timecode": "Финал",
        "intensity_pct": (80, 100),
        "goal": (
            "Payoff. Нюансированный моральный синтез: "
            "ответ на загадку + открытый этический вопрос."
        ),
    },
}


@dataclass
class EvidenceLoop:
    """
    Петля Доказательства (Evidence Loop) — базовая единица сценария.

    Гибрид «Сюжетной петли» Кэллоуэя и метода доказательств Харриса.
    """

    context: str        # Утверждение или гипотеза
    deictic_driver: str  # «Посмотрите на эту карту»
    evidence: str       # Визуальный Якорь (описание визуала)
    reveal: str         # Микро-Раскрытие: интерпретация факта
    transition: str     # Переход: «НО ... СЛЕДОВАТЕЛЬНО ...»


@dataclass
class ScriptBlock:
    """Блок сценария длительностью ~2 минуты с привязкой к фазе Зубчатой дуги."""

    phase: SerratedPhase
    timecode_start: str           # "MM:SS"
    timecode_end: str             # "MM:SS"
    evidence_loops: list[EvidenceLoop] = field(default_factory=list)
    rehook_text: str = ""         # Текст перезацепа в конце блока
    intensity_pct: int = 50


# ---------------------------------------------------------------------------
# Часть 5 + Часть 8. A/V Сценарий (двухколоночный)
# ---------------------------------------------------------------------------

class VisualType(Enum):
    """Типы визуальной стимуляции (Pattern Interrupts)."""

    BROLL = "b-roll"
    STOCK_FOOTAGE = "stock_footage"
    TEXT_OVERLAY = "text_overlay"
    MEME_REFERENCE = "meme_reference"
    SNAP_ZOOM = "snap_zoom"
    MAP = "map"
    DOCUMENT = "document"
    TALKING_HEAD = "talking_head"


@dataclass
class AVLine:
    """Одна строка двухколоночного A/V сценария."""

    timecode: str           # "MM:SS"
    audio_text: str         # Что говорит автор
    visual_description: str  # Что видит зритель
    visual_type: VisualType
    sfx: str = ""           # Звуковой эффект (whoosh, paper rustle и т.д.)
    music_mood: str = ""    # Настроение музыки (ambient, driving beat, epic)


@dataclass
class AVScript:
    """Полный двухколоночный A/V сценарий."""

    title: str
    promise: str                 # Главное обещание видео (The Promise)
    hook: Hook
    blocks: list[ScriptBlock] = field(default_factory=list)
    av_lines: list[AVLine] = field(default_factory=list)
    total_duration_sec: int = 0


# ---------------------------------------------------------------------------
# Часть 9. Типология контента
# ---------------------------------------------------------------------------

class ContentType(Enum):
    """Типология контента для «Умного блокбастера»."""

    INVESTIGATION = "investigation"   # Расследование
    EXPLAINER = "explainer"           # Эксплейнер
    GEOPOLITICS = "geopolitics"       # Геополитика
    BUSINESS = "business"             # Бизнес


CONTENT_TYPE_META: dict[str, dict[str, str]] = {
    ContentType.INVESTIGATION.value: {
        "name_ru": "Расследование",
        "hook_approach": "«Следователь» + «Eyes Only»",
        "visual_anchor": "Секретный документ, переписка",
        "example": "«Я нашёл контракт, который убивает интернет»",
    },
    ContentType.EXPLAINER.value: {
        "name_ru": "Эксплейнер",
        "hook_approach": "«Учитель» + «Система как злодей»",
        "visual_anchor": "Механизм, разобранный на части",
        "example": "«Как на самом деле работает алгоритм цен на авиабилеты»",
    },
    ContentType.GEOPOLITICS.value: {
        "name_ru": "Геополитика",
        "hook_approach": "«Волшебник» + «Карта как персонаж»",
        "visual_anchor": "Аномалия на карте, Граница",
        "example": "«Почему эта линия на карте стоит триллион долларов»",
    },
    ContentType.BUSINESS.value: {
        "name_ru": "Бизнес",
        "hook_approach": "«Противник» + «System Failure»",
        "visual_anchor": "Отчётность, График падения",
        "example": "«Почему Starbucks на самом деле банк, а не кофейня»",
    },
}
