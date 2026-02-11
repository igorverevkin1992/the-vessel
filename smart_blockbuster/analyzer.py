"""
Анализатор сценария — Части 5, 6, 7 мануала «Умный блокбастер».

Реализует:
- Анализ стиля «Стаккато» (короткие предложения, рубленый ритм)
- Проверку разговорных коннекторов Харриса
- Проверку Visual Matching (визуал соответствует аудио)
- Анализ ритма монтажа (Pattern Interrupts)
- Проверку звукового дизайна
- Оценку персоны «Любопытный Исследователь»
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from .models import AVLine, AVScript, VisualType


# ---------------------------------------------------------------------------
# Часть 6.2. Анализ стиля «Стаккато»
# ---------------------------------------------------------------------------

@dataclass
class StaccatoReport:
    """Результат анализа текста на соответствие стилю Стаккато."""

    total_sentences: int
    avg_words_per_sentence: float
    short_sentences_pct: float    # <= 8 слов
    long_sentences: list[str]     # > 20 слов — проблемные
    verdict: str


def analyze_staccato(text: str) -> StaccatoReport:
    """
    Анализирует текст сценария на соответствие стилю «Стаккато».

    Правила из PDF:
    - Рубленый ритм. Короткие предложения.
    - «Это проблема. Большая проблема. И вот почему.»
    - Правило 6-го класса: слова, понятные 12-летнему.
    """
    sentences = re.split(r"[.!?]+", text)
    sentences = [s.strip() for s in sentences if s.strip()]

    if not sentences:
        return StaccatoReport(
            total_sentences=0,
            avg_words_per_sentence=0.0,
            short_sentences_pct=0.0,
            long_sentences=[],
            verdict="Текст пуст.",
        )

    word_counts = [len(s.split()) for s in sentences]
    avg = sum(word_counts) / len(word_counts)
    short = sum(1 for c in word_counts if c <= 8)
    short_pct = short / len(sentences)
    long = [s for s, c in zip(sentences, word_counts) if c > 20]

    if avg <= 8 and short_pct >= 0.6:
        verdict = "Стиль Стаккато соблюдён. Ритм рубленый и динамичный."
    elif avg <= 12:
        verdict = (
            "Допустимо, но можно разбить длинные предложения. "
            "Цель: среднее <= 8 слов."
        )
    else:
        verdict = (
            "ПРОБЛЕМА: Предложения слишком длинные. "
            "Текст не подходит для восприятия на слух. "
            "Разбейте на короткие фразы в стиле Стаккато."
        )

    return StaccatoReport(
        total_sentences=len(sentences),
        avg_words_per_sentence=round(avg, 1),
        short_sentences_pct=round(short_pct, 2),
        long_sentences=long[:5],
        verdict=verdict,
    )


def format_staccato_report(report: StaccatoReport) -> str:
    """Форматирует отчёт анализа Стаккато."""
    lines = [
        "=" * 60,
        "  АНАЛИЗ СТИЛЯ «СТАККАТО»",
        "  (Часть 6.2: Атомарный месседжинг)",
        "=" * 60,
        "",
        f"  Всего предложений:         {report.total_sentences}",
        f"  Среднее слов/предложение:  {report.avg_words_per_sentence}",
        f"  Короткие (<= 8 слов):      {report.short_sentences_pct:.0%}",
    ]

    if report.long_sentences:
        lines.append(f"\n  Проблемные предложения (> 20 слов):")
        for s in report.long_sentences:
            preview = s[:80] + "..." if len(s) > 80 else s
            lines.append(f"    - «{preview}»")

    lines.append(f"\n  Вердикт: {report.verdict}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Часть 6.3. Разговорные коннекторы Харриса
# ---------------------------------------------------------------------------

HARRIS_CONNECTORS = {
    "basically": {
        "ru": ["по сути", "в основном", "в целом"],
        "en": ["basically"],
        "role": "Маркер упрощения сложной концепции",
    },
    "honestly": {
        "ru": ["честно говоря", "если честно", "откровенно"],
        "en": ["honestly"],
        "role": "Маркер перехода к личному мнению",
    },
    "actually": {
        "ru": ["на самом деле", "в действительности", "фактически"],
        "en": ["actually"],
        "role": "Маркер разрушения мифа (Contrarian moment)",
    },
    "look_at_this": {
        "ru": ["посмотрите на это", "посмотрите сюда", "взгляните",
               "вот здесь", "обратите внимание"],
        "en": ["look at this", "look at that", "check this out"],
        "role": "Маркер визуального якоря (Deictic Driver)",
    },
}


def analyze_connectors(text: str) -> dict:
    """
    Анализирует текст на наличие разговорных коннекторов Харриса.

    Цель: создание атмосферы «разговора в кофейне» (Coffee Shop Tone).
    """
    text_lower = text.lower()
    results = {}

    for connector_id, data in HARRIS_CONNECTORS.items():
        all_variants = data["ru"] + data["en"]
        found = []
        for variant in all_variants:
            count = text_lower.count(variant)
            if count > 0:
                found.append((variant, count))

        results[connector_id] = {
            "role": data["role"],
            "found": found,
            "total": sum(c for _, c in found),
        }

    return results


def format_connectors_report(analysis: dict) -> str:
    """Форматирует отчёт по коннекторам Харриса."""
    lines = [
        "=" * 60,
        "  РАЗГОВОРНЫЕ КОННЕКТОРЫ ХАРРИСА",
        "  (Coffee Shop Tone)",
        "=" * 60,
    ]

    total_found = 0
    for connector_id, data in analysis.items():
        total_found += data["total"]
        status = f"x{data['total']}" if data["total"] > 0 else "—"
        lines.append(f"\n  [{status}] {data['role']}")
        if data["found"]:
            for variant, count in data["found"]:
                lines.append(f"       «{variant}» — {count} раз")

    lines.append(f"\n  Всего коннекторов: {total_found}")

    if total_found == 0:
        lines.append("  РЕКОМЕНДАЦИЯ: Добавить коннекторы для живого тона.")
    elif total_found < 3:
        lines.append("  РЕКОМЕНДАЦИЯ: Мало коннекторов. Добавить ещё для естественности.")
    else:
        lines.append("  Тон «Coffee Shop» выдержан.")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Часть 5.1. Анализ ритма монтажа (Pattern Interrupts)
# ---------------------------------------------------------------------------

def analyze_editing_rhythm(av_lines: list[AVLine]) -> dict:
    """
    Анализирует A/V сценарий на соответствие правилам монтажа.

    Правила из PDF:
    - Хук: смена кадра каждые 0.5–1.5 сек.
    - Основная часть: каждые 3–5 сек.
    - Статичная «говорящая голова» > 5 секунд = смерть удержания.
    - Нужны Pattern Interrupts: B-Roll, Stock, Text Overlay, Meme, Snap Zoom.
    """
    if not av_lines:
        return {
            "total_lines": 0,
            "visual_types_used": set(),
            "talking_head_sequences": 0,
            "pattern_interrupt_density": 0.0,
            "verdict": "A/V сценарий пуст.",
        }

    visual_types_used = set(line.visual_type for line in av_lines)

    # Подсчёт последовательных talking_head
    talking_head_sequences = 0
    consecutive = 0
    for line in av_lines:
        if line.visual_type == VisualType.TALKING_HEAD:
            consecutive += 1
            if consecutive >= 3:
                talking_head_sequences += 1
        else:
            consecutive = 0

    # Плотность pattern interrupts (не talking_head)
    non_th = sum(1 for l in av_lines if l.visual_type != VisualType.TALKING_HEAD)
    density = non_th / len(av_lines) if av_lines else 0

    all_types = set(VisualType)
    missing = all_types - visual_types_used

    if density >= 0.6 and talking_head_sequences == 0:
        verdict = "Монтаж динамичный. Pattern Interrupts достаточно."
    elif density >= 0.4:
        verdict = "Допустимо, но добавьте больше визуального разнообразия."
    else:
        verdict = (
            "ПРОБЛЕМА: Слишком много «говорящей головы». "
            "Добавить B-Roll, карты, документы, Text Overlay."
        )

    return {
        "total_lines": len(av_lines),
        "visual_types_used": visual_types_used,
        "visual_types_missing": missing,
        "talking_head_sequences": talking_head_sequences,
        "pattern_interrupt_density": round(density, 2),
        "verdict": verdict,
    }


# ---------------------------------------------------------------------------
# Часть 7. Анализ звукового дизайна
# ---------------------------------------------------------------------------

def analyze_sound_design(av_lines: list[AVLine]) -> dict:
    """
    Анализирует A/V сценарий на наличие звукового дизайна.

    Правила из PDF:
    - Каждое визуальное действие = звук (SFX)
    - Появление текста = Whoosh / Typewriter click
    - Движение карты = Paper rustle
    - Хайлайт текста = Marker stroke sound
    - Музыка меняется с фазами: Тайна → Расследование → Откровение
    """
    if not av_lines:
        return {"total": 0, "with_sfx": 0, "with_music": 0, "verdict": "Пусто."}

    with_sfx = sum(1 for l in av_lines if l.sfx.strip())
    with_music = sum(1 for l in av_lines if l.music_mood.strip())

    sfx_ratio = with_sfx / len(av_lines) if av_lines else 0
    music_ratio = with_music / len(av_lines) if av_lines else 0

    issues = []
    if sfx_ratio < 0.3:
        issues.append("Мало SFX. Без звуковых эффектов видео ощущается «мёртвым».")
    if music_ratio < 0.5:
        issues.append("Мало музыкальных указаний. Музыка должна меняться с сюжетом.")

    verdict = " ".join(issues) if issues else "Звуковой дизайн проработан."

    return {
        "total": len(av_lines),
        "with_sfx": with_sfx,
        "sfx_ratio": round(sfx_ratio, 2),
        "with_music": with_music,
        "music_ratio": round(music_ratio, 2),
        "verdict": verdict,
    }


# ---------------------------------------------------------------------------
# Комплексный анализ сценария
# ---------------------------------------------------------------------------

def full_script_analysis(script: AVScript) -> str:
    """Полный анализ сценария «Умного блокбастера»."""
    lines = [
        "=" * 70,
        f"  ПОЛНЫЙ АНАЛИЗ СЦЕНАРИЯ: «{script.title}»",
        "  Методология «Умный блокбастер»",
        "=" * 70,
    ]

    # 1. Анализ текста хука
    if script.hook:
        from .hook_engine import validate_hook, format_validation_report
        hook_results = validate_hook(script.hook)
        lines.append("\n" + format_validation_report(hook_results))

    # 2. Анализ текста на Стаккато
    all_audio = " ".join(l.audio_text for l in script.av_lines)
    if all_audio.strip():
        staccato = analyze_staccato(all_audio)
        lines.append("\n" + format_staccato_report(staccato))

    # 3. Коннекторы Харриса
    if all_audio.strip():
        connectors = analyze_connectors(all_audio)
        lines.append("\n" + format_connectors_report(connectors))

    # 4. But/Therefore
    if all_audio.strip():
        from .structure import analyze_but_therefore, format_but_therefore_report
        bt = analyze_but_therefore(all_audio)
        lines.append("\n" + format_but_therefore_report(bt))

    # 5. Ритм монтажа
    if script.av_lines:
        rhythm = analyze_editing_rhythm(script.av_lines)
        lines.append("\n" + _format_rhythm_report(rhythm))

    # 6. Звуковой дизайн
    if script.av_lines:
        sound = analyze_sound_design(script.av_lines)
        lines.append("\n" + _format_sound_report(sound))

    return "\n".join(lines)


def _format_rhythm_report(rhythm: dict) -> str:
    lines = [
        "=" * 60,
        "  РИТМ МОНТАЖА (Pattern Interrupts)",
        "  (Часть 5.1: Visual Stun Gun)",
        "=" * 60,
        "",
        f"  Строк A/V:                    {rhythm['total_lines']}",
        f"  Плотность Pattern Interrupts: {rhythm['pattern_interrupt_density']:.0%}",
        f"  Длинные серии Talking Head:   {rhythm['talking_head_sequences']}",
    ]

    if rhythm.get("visual_types_used"):
        used = ", ".join(t.value for t in rhythm["visual_types_used"])
        lines.append(f"  Используемые типы визуала:   {used}")

    if rhythm.get("visual_types_missing"):
        missing = ", ".join(t.value for t in rhythm["visual_types_missing"])
        lines.append(f"  Неиспользуемые типы:         {missing}")

    lines.append(f"\n  Вердикт: {rhythm['verdict']}")
    return "\n".join(lines)


def _format_sound_report(sound: dict) -> str:
    lines = [
        "=" * 60,
        "  ЗВУКОВОЙ ДИЗАЙН",
        "  (Часть 7: Невидимый драйвер)",
        "=" * 60,
        "",
        f"  Всего строк A/V:    {sound['total']}",
        f"  С SFX:              {sound['with_sfx']} ({sound.get('sfx_ratio', 0):.0%})",
        f"  С музыкой:          {sound['with_music']} ({sound.get('music_ratio', 0):.0%})",
        f"\n  Вердикт: {sound['verdict']}",
    ]
    return "\n".join(lines)
