"""
Сценарная структура — Часть 4 мануала «Умный блокбастер».

Реализует:
- Зубчатую дугу (The Serrated Edge) — 5 фаз макро-структуры
- Петли Доказательств (Evidence Loops) — микро-структуру сценария
- Принцип «But / Therefore» — анализ и трансформацию связок
- Генерацию скелета сюжета (Story Skeleton)
"""

from __future__ import annotations

import re

from .models import (
    EvidenceLoop,
    ScriptBlock,
    SerratedPhase,
    SERRATED_PHASE_META,
)


# ---------------------------------------------------------------------------
# Зубчатая дуга (The Serrated Edge)
# ---------------------------------------------------------------------------

def generate_serrated_edge(total_duration_min: int) -> list[ScriptBlock]:
    """
    Генерирует скелет Зубчатой дуги для видео заданной длительности.

    Логика разбивки (из PDF):
    - Фаза 1 (Высокий старт): 0:00 – 1:00
    - Фаза 2 (Контекстный мост): 1:00 – 3:00
    - Фазы 3–4 (Перезацеп + Расследование): середина, блоками по 2–3 мин
    - Фаза 5 (Синтез): последние ~2 мин
    """
    blocks: list[ScriptBlock] = []

    # Фаза 1: Высокий старт (первая минута)
    blocks.append(ScriptBlock(
        phase=SerratedPhase.HIGH_START,
        timecode_start="00:00",
        timecode_end="01:00",
        intensity_pct=95,
        rehook_text="",
    ))

    # Фаза 2: Контекстный мост (1:00 – 3:00)
    blocks.append(ScriptBlock(
        phase=SerratedPhase.CONTEXT_BRIDGE,
        timecode_start="01:00",
        timecode_end="03:00",
        intensity_pct=35,
        rehook_text="[Перезацеп: ввести новый конфликт для перехода к расследованию]",
    ))

    # Фазы 3-4: чередование Перезацеп + Расследование
    current_min = 3
    end_min = max(total_duration_min - 2, current_min + 2)
    block_idx = 0

    while current_min < end_min:
        block_len = min(3 if block_idx % 2 == 0 else 2, end_min - current_min)
        if block_len <= 0:
            break

        next_min = current_min + block_len

        if block_idx % 2 == 0:
            # Расследование
            blocks.append(ScriptBlock(
                phase=SerratedPhase.INVESTIGATION,
                timecode_start=f"{current_min:02d}:00",
                timecode_end=f"{next_min:02d}:00",
                intensity_pct=60,
                rehook_text="",
            ))
        else:
            # Перезацеп
            blocks.append(ScriptBlock(
                phase=SerratedPhase.REHOOK,
                timecode_start=f"{current_min:02d}:00",
                timecode_end=f"{next_min:02d}:00",
                intensity_pct=80,
                rehook_text="[Новый конфликт / Поворот сюжета]",
            ))

        current_min = next_min
        block_idx += 1

    # Фаза 5: Синтез (финальные ~2 минуты)
    blocks.append(ScriptBlock(
        phase=SerratedPhase.SYNTHESIS,
        timecode_start=f"{end_min:02d}:00",
        timecode_end=f"{total_duration_min:02d}:00",
        intensity_pct=90,
        rehook_text="",
    ))

    return blocks


def format_serrated_edge(blocks: list[ScriptBlock]) -> str:
    """Форматирует Зубчатую дугу для вывода."""
    lines = [
        "=" * 70,
        "  ЗУБЧАТАЯ ДУГА (THE SERRATED EDGE)",
        "  Макро-структура сценария",
        "=" * 70,
    ]

    for i, block in enumerate(blocks, 1):
        meta = SERRATED_PHASE_META[block.phase.value]
        bar_len = block.intensity_pct // 2
        bar = "#" * bar_len + "." * (50 - bar_len)

        lines.append(f"\n  [{block.timecode_start} – {block.timecode_end}]"
                      f"  {meta['name_ru']}")
        lines.append(f"  Интенсивность: [{bar}] {block.intensity_pct}%")
        lines.append(f"  Задача: {meta['goal'][:100]}")
        if block.rehook_text:
            lines.append(f"  Перезацеп: {block.rehook_text}")

        loop_count = len(block.evidence_loops)
        if loop_count > 0:
            lines.append(f"  Петель доказательств: {loop_count}")
        else:
            lines.append("  Петли доказательств: [Заполнить]")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Петля Доказательства (Evidence Loop)
# ---------------------------------------------------------------------------

def build_evidence_loop_interactive() -> EvidenceLoop:
    """Интерактивный конструктор Петли Доказательства."""
    print("\n" + "-" * 60)
    print("  ПЕТЛЯ ДОКАЗАТЕЛЬСТВА (Evidence Loop)")
    print("  Базовая единица сценария «Умного блокбастера»")
    print("-" * 60)

    print("\n1. Контекст (Context)")
    print("   Утверждение или гипотеза.")
    print("   Пример: «Китай захватывает порты».")
    context = input("   Ваш контекст: ")

    print("\n2. Дейктический драйвер (Deictic Driver)")
    print("   Фраза-указатель для совместного внимания.")
    print("   Пример: «Посмотрите на эту карту».")
    deictic = input("   Ваш драйвер: ")

    print("\n3. Визуальный Якорь (Evidence)")
    print("   Описание того, что видит зритель.")
    print("   Пример: [Показ карты Шри-Ланки с выделенным портом].")
    evidence = input("   Ваш визуал: ")

    print("\n4. Микро-Раскрытие (Reveal)")
    print("   Интерпретация факта.")
    print("   Пример: «Это не просто порт, это территория Китая на 99 лет».")
    reveal = input("   Ваше раскрытие: ")

    print("\n5. Переход (But / Therefore)")
    print("   Связка к следующей петле через конфликт.")
    print("   Пример: «НО это создаёт проблему для Индии, СЛЕДОВАТЕЛЬНО...».")
    transition = input("   Ваш переход: ")

    return EvidenceLoop(
        context=context,
        deictic_driver=deictic,
        evidence=evidence,
        reveal=reveal,
        transition=transition,
    )


def format_evidence_loop(loop: EvidenceLoop, index: int = 1) -> str:
    """Форматирует одну Петлю Доказательства."""
    return (
        f"\n  Петля #{index}\n"
        f"  1. Контекст:    {loop.context}\n"
        f"  2. Драйвер:     {loop.deictic_driver}\n"
        f"  3. Визуал:      [{loop.evidence}]\n"
        f"  4. Раскрытие:   {loop.reveal}\n"
        f"  5. Переход:     {loop.transition}"
    )


# ---------------------------------------------------------------------------
# Принцип «But / Therefore» (Но / Следовательно)
# ---------------------------------------------------------------------------

# Паттерны «И затем» на русском и английском
_AND_THEN_PATTERNS_RU = [
    r"\bи\s+затем\b", r"\bи\s+потом\b", r"\bпосле\s+этого\b",
    r"\bа\s+потом\b", r"\bпосле\s+чего\b", r"\bзатем\b",
]
_AND_THEN_PATTERNS_EN = [
    r"\band\s+then\b", r"\bafter\s+that\b", r"\bnext\b",
]

# Паттерны «Но / Следовательно»
_BUT_THEREFORE_PATTERNS_RU = [
    r"\bно\b", r"\bоднако\b", r"\bвпрочем\b",
    r"\bследовательно\b", r"\bпоэтому\b", r"\bв\s+результате\b",
    r"\bиз-за\s+этого\b", r"\bтаким\s+образом\b",
]
_BUT_THEREFORE_PATTERNS_EN = [
    r"\bbut\b", r"\bhowever\b", r"\btherefore\b", r"\bconsequently\b",
]


def analyze_but_therefore(text: str) -> dict:
    """
    Анализирует текст на соотношение «И затем» vs «Но / Следовательно».

    Золотое правило: все связки «И затем» должны быть заменены на «Но» или
    «Следовательно» для создания конфликта и причинно-следственных связей.
    """
    text_lower = text.lower()

    and_then_matches = []
    for pattern in _AND_THEN_PATTERNS_RU + _AND_THEN_PATTERNS_EN:
        for match in re.finditer(pattern, text_lower):
            and_then_matches.append(match.group())

    but_therefore_matches = []
    for pattern in _BUT_THEREFORE_PATTERNS_RU + _BUT_THEREFORE_PATTERNS_EN:
        for match in re.finditer(pattern, text_lower):
            but_therefore_matches.append(match.group())

    and_then_count = len(and_then_matches)
    but_therefore_count = len(but_therefore_matches)
    total = and_then_count + but_therefore_count

    if total == 0:
        ratio = 0.0
    else:
        ratio = but_therefore_count / total

    return {
        "and_then_count": and_then_count,
        "and_then_examples": and_then_matches[:10],
        "but_therefore_count": but_therefore_count,
        "but_therefore_examples": but_therefore_matches[:10],
        "ratio": ratio,
        "verdict": _but_therefore_verdict(ratio, and_then_count),
    }


def _but_therefore_verdict(ratio: float, and_then_count: int) -> str:
    if and_then_count == 0:
        return "Связки «И затем» не обнаружены. Текст драматургически чист."
    if ratio >= 0.8:
        return "Отлично: преобладают причинно-следственные связки."
    if ratio >= 0.5:
        return "Допустимо, но есть места для усиления конфликта."
    return (
        "ПРОБЛЕМА: Слишком много «И затем». Текст читается как перечисление. "
        "Замените на «НО» (конфликт) или «СЛЕДОВАТЕЛЬНО» (решение)."
    )


def format_but_therefore_report(analysis: dict) -> str:
    """Форматирует отчёт анализа But/Therefore."""
    lines = [
        "=" * 60,
        "  АНАЛИЗ «BUT / THEREFORE»",
        "  (Золотое правило драматургии South Park)",
        "=" * 60,
        "",
        f"  «И затем» (скука):        {analysis['and_then_count']}",
    ]

    if analysis["and_then_examples"]:
        lines.append(f"    Примеры: {', '.join(analysis['and_then_examples'][:5])}")

    lines.append(f"  «Но / Следовательно» (драма): {analysis['but_therefore_count']}")

    if analysis["but_therefore_examples"]:
        lines.append(f"    Примеры: {', '.join(analysis['but_therefore_examples'][:5])}")

    lines.append(f"\n  Соотношение драмы: {analysis['ratio']:.0%}")
    lines.append(f"  Вердикт: {analysis['verdict']}")

    return "\n".join(lines)
